var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parsePagination } from '../../common/utils/pagination';
import { formatCsvDate, generateCsv } from './csv-export.util';

/**
 * Validates and normalizes date range parameters.
 */
function parseDateRange(query) {
    let start = null;
    let end = null;
    if (query.startDate) {
        start = new Date(query.startDate);
        if (isNaN(start.getTime())) {
            throw ApiError.badRequest('INVALID_START_DATE', 'startDate must be a valid ISO-8601 date string');
        }
    }
    if (query.endDate) {
        end = new Date(query.endDate);
        if (isNaN(end.getTime())) {
            throw ApiError.badRequest('INVALID_END_DATE', 'endDate must be a valid ISO-8601 date string');
        }
        if (typeof query.endDate === 'string' && query.endDate.length <= 10) {
            end.setUTCHours(23, 59, 59, 999);
        }
    }
    if (start && end && start > end) {
        throw ApiError.badRequest('INVALID_DATE_RANGE', 'startDate must not be later than endDate');
    }
    return { start, end };
}

let ReportsService = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }

    // =========================================================================
    // 1. CALL ACTIVITY REPORT
    // =========================================================================

    buildCallWhere(actor, query) {
        const { start, end } = parseDateRange(query);
        const where = {};

        // Role scoping
        if (actor.roleCode === 'AGENT') {
            where.agentId = actor.id;
        } else if (query.agentId) {
            where.agentId = query.agentId;
        }

        // Date range
        if (start || end) {
            where.startedAt = {};
            if (start) where.startedAt.gte = start;
            if (end) where.startedAt.lte = end;
        }

        if (query.status) {
            where.status = query.status;
        }
        if (query.outcome) {
            where.outcome = query.outcome;
        }
        return where;
    }

    formatCallDuration(call) {
        if (call.endedAt && call.connectedAt) {
            const ms = new Date(call.endedAt).getTime() - new Date(call.connectedAt).getTime();
            return Math.max(0, Math.round(ms / 1000));
        }
        return 0;
    }

    async getCallReport(actor, query) {
        const where = this.buildCallWhere(actor, query);
        const pagination = parsePagination(query.page, query.pageSize);

        const [total, rawCalls] = await Promise.all([
            this.prisma.call.count({ where }),
            this.prisma.call.findMany({
                where,
                orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    agent: { select: { id: true, employeeCode: true, fullName: true, department: true } },
                    customer: { select: { id: true, farmerCode: true, fullName: true } },
                },
            }),
        ]);

        const items = rawCalls.map((c) => ({
            ...c,
            durationSeconds: this.formatCallDuration(c),
        }));

        return {
            items,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: Math.ceil(total / pagination.pageSize),
        };
    }

    async exportCallsCsv(actor, query) {
        const where = this.buildCallWhere(actor, query);
        const rawCalls = await this.prisma.call.findMany({
            where,
            orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
            take: 5000,
            include: {
                agent: { select: { id: true, employeeCode: true, fullName: true, department: true } },
                customer: { select: { id: true, farmerCode: true, fullName: true } },
            },
        });

        const rows = rawCalls.map((c) => ({
            ...c,
            durationSeconds: this.formatCallDuration(c),
        }));

        const columns = [
            { key: 'id', header: 'Call ID' },
            { key: 'startedAt', header: 'Date & Time', format: (val) => formatCsvDate(val) },
            { key: 'agentCode', header: 'Agent Code', format: (_, r) => r.agent?.employeeCode || '—' },
            { key: 'agentName', header: 'Agent Name', format: (_, r) => r.agent?.fullName || '—' },
            { key: 'farmerCode', header: 'Farmer Code', format: (_, r) => r.customer?.farmerCode || '—' },
            { key: 'farmerName', header: 'Farmer Name', format: (_, r) => r.customer?.fullName || '—' },
            { key: 'phoneNumber', header: 'Phone Number' },
            { key: 'direction', header: 'Direction' },
            { key: 'status', header: 'Status' },
            { key: 'outcome', header: 'Outcome', format: (val) => val || '—' },
            { key: 'nextAction', header: 'Next Action', format: (val) => val || '—' },
            { key: 'durationSeconds', header: 'Duration (Seconds)' },
            { key: 'connectedAt', header: 'Connected At', format: (val) => formatCsvDate(val) },
            { key: 'endedAt', header: 'Ended At', format: (val) => formatCsvDate(val) },
        ];

        const csv = generateCsv(columns, rows);
        return {
            filename: `grotec_calls_report_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }

    // =========================================================================
    // 2. FOLLOW-UP DISCIPLINE REPORT
    // =========================================================================

    buildFollowUpWhere(actor, query) {
        const { start, end } = parseDateRange(query);
        const where = {};

        if (actor.roleCode === 'AGENT') {
            where.agentId = actor.id;
        } else if (query.agentId) {
            where.agentId = query.agentId;
        }

        if (start || end) {
            where.dueAt = {};
            if (start) where.dueAt.gte = start;
            if (end) where.dueAt.lte = end;
        }

        if (query.overdue === 'true' || query.overdue === true) {
            where.status = 'PENDING';
            where.dueAt = { ...(where.dueAt || {}), lt: new Date() };
        } else if (query.status) {
            where.status = query.status;
        }

        return where;
    }

    async getFollowUpReport(actor, query) {
        const where = this.buildFollowUpWhere(actor, query);
        const pagination = parsePagination(query.page, query.pageSize);

        const [total, items] = await Promise.all([
            this.prisma.followUp.count({ where }),
            this.prisma.followUp.findMany({
                where,
                orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    agent: { select: { id: true, employeeCode: true, fullName: true } },
                    customer: { select: { id: true, farmerCode: true, fullName: true } },
                },
            }),
        ]);

        return {
            items,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: Math.ceil(total / pagination.pageSize),
        };
    }

    async exportFollowUpsCsv(actor, query) {
        const where = this.buildFollowUpWhere(actor, query);
        const rows = await this.prisma.followUp.findMany({
            where,
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            take: 5000,
            include: {
                agent: { select: { id: true, employeeCode: true, fullName: true } },
                customer: { select: { id: true, farmerCode: true, fullName: true } },
            },
        });

        const columns = [
            { key: 'id', header: 'Follow-Up ID' },
            { key: 'dueAt', header: 'Due Date & Time', format: (val) => formatCsvDate(val) },
            { key: 'status', header: 'Status' },
            { key: 'completedAt', header: 'Completed Date & Time', format: (val) => formatCsvDate(val) },
            { key: 'agentCode', header: 'Agent Code', format: (_, r) => r.agent?.employeeCode || '—' },
            { key: 'agentName', header: 'Agent Name', format: (_, r) => r.agent?.fullName || '—' },
            { key: 'farmerCode', header: 'Farmer Code', format: (_, r) => r.customer?.farmerCode || '—' },
            { key: 'farmerName', header: 'Farmer Name', format: (_, r) => r.customer?.fullName || '—' },
            { key: 'note', header: 'Note', format: (val) => val || '—' },
        ];

        const csv = generateCsv(columns, rows);
        return {
            filename: `grotec_follow_ups_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }

    // =========================================================================
    // 3. CUSTOMER / FARMER MASTER REPORT
    // =========================================================================

    buildCustomerWhere(actor, query) {
        const where = { deletedAt: null };

        if (query.status) {
            where.status = query.status;
        }
        if (query.soilType) {
            where.soilType = query.soilType;
        }
        if (query.district) {
            where.locations = {
                some: {
                    district: { contains: query.district, mode: 'insensitive' },
                    deletedAt: null,
                },
            };
        }
        if (query.search) {
            const s = query.search.trim();
            where.OR = [
                { fullName: { contains: s, mode: 'insensitive' } },
                { farmerCode: { contains: s, mode: 'insensitive' } },
                { phones: { some: { phoneE164: { contains: s } } } },
            ];
        }
        return where;
    }

    async getCustomerReport(actor, query) {
        const where = this.buildCustomerWhere(actor, query);
        const pagination = parsePagination(query.page, query.pageSize);

        const [total, items] = await Promise.all([
            this.prisma.customer.count({ where }),
            this.prisma.customer.findMany({
                where,
                orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    phones: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' }, take: 1 },
                    locations: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' }, take: 1 },
                },
            }),
        ]);

        return {
            items,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: Math.ceil(total / pagination.pageSize),
        };
    }

    async exportCustomersCsv(actor, query) {
        const where = this.buildCustomerWhere(actor, query);
        const rows = await this.prisma.customer.findMany({
            where,
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            take: 5000,
            include: {
                phones: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' }, take: 1 },
                locations: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' }, take: 1 },
            },
        });

        const columns = [
            { key: 'id', header: 'Customer ID' },
            { key: 'farmerCode', header: 'Farmer Code', format: (val) => val || '—' },
            { key: 'fullName', header: 'Full Name' },
            { key: 'phone', header: 'Phone Number', format: (_, r) => r.phones?.[0]?.phoneE164 || '—' },
            { key: 'status', header: 'Status' },
            { key: 'soilType', header: 'Soil Type', format: (val) => val || '—' },
            { key: 'village', header: 'Primary Village', format: (_, r) => r.locations?.[0]?.village || '—' },
            { key: 'taluk', header: 'Primary Taluk', format: (_, r) => r.locations?.[0]?.taluk || '—' },
            { key: 'district', header: 'Primary District', format: (_, r) => r.locations?.[0]?.district || '—' },
            { key: 'state', header: 'Primary State', format: (_, r) => r.locations?.[0]?.state || '—' },
            { key: 'createdAt', header: 'Registered Date', format: (val) => formatCsvDate(val) },
        ];

        const csv = generateCsv(columns, rows);
        return {
            filename: `grotec_farmers_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }

    // =========================================================================
    // 4. LEADS PIPELINE REPORT
    // =========================================================================

    buildLeadWhere(actor, query) {
        const where = { deletedAt: null };
        if (actor.roleCode === 'AGENT') {
            where.ownerships = { some: { employeeId: actor.id, releasedAt: null } };
        }
        if (query.status) {
            where.status = query.status;
        }
        return where;
    }

    async getLeadReport(actor, query) {
        const where = this.buildLeadWhere(actor, query);
        const pagination = parsePagination(query.page, query.pageSize);

        const [total, items] = await Promise.all([
            this.prisma.lead.count({ where }),
            this.prisma.lead.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    customer: { select: { id: true, farmerCode: true, fullName: true } },
                    ownerships: {
                        where: { releasedAt: null },
                        include: { employee: { select: { id: true, employeeCode: true, fullName: true } } },
                        take: 1,
                    },
                },
            }),
        ]);

        return {
            items,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: Math.ceil(total / pagination.pageSize),
        };
    }

    async exportLeadsCsv(actor, query) {
        const where = this.buildLeadWhere(actor, query);
        const rows = await this.prisma.lead.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 5000,
            include: {
                customer: { select: { id: true, farmerCode: true, fullName: true } },
                ownerships: {
                    where: { releasedAt: null },
                    include: { employee: { select: { id: true, employeeCode: true, fullName: true } } },
                    take: 1,
                },
            },
        });

        const columns = [
            { key: 'id', header: 'Lead ID' },
            { key: 'farmerCode', header: 'Farmer Code', format: (_, r) => r.customer?.farmerCode || '—' },
            { key: 'farmerName', header: 'Farmer Name', format: (_, r) => r.customer?.fullName || '—' },
            { key: 'status', header: 'Lead Status' },
            { key: 'source', header: 'Source', format: (val) => val || '—' },
            { key: 'assignedAgent', header: 'Assigned Agent', format: (_, r) => r.ownerships?.[0]?.employee?.fullName || 'Unassigned' },
            { key: 'assignedAgentCode', header: 'Agent Code', format: (_, r) => r.ownerships?.[0]?.employee?.employeeCode || '—' },
            { key: 'createdAt', header: 'Created Date', format: (val) => formatCsvDate(val) },
        ];

        const csv = generateCsv(columns, rows);
        return {
            filename: `grotec_leads_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }

    // =========================================================================
    // 5. OPERATIONAL AGENT LEADERBOARD
    // =========================================================================

    getLeaderboardWindow(period = 'month', customStart, customEnd) {
        const now = new Date();
        let startDate;
        let endDate;

        if (period === 'today') {
            startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
            endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        } else if (period === 'week') {
            startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));
            endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        } else if (period === 'custom' && customStart && customEnd) {
            startDate = new Date(customStart);
            endDate = new Date(customEnd);
            if (typeof customEnd === 'string' && customEnd.length <= 10) {
                endDate.setUTCHours(23, 59, 59, 999);
            }
        } else {
            // Default: month
            startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
            endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        }

        return { startDate, endDate };
    }

    async getLeaderboard(actor, query = {}) {
        const period = query.period || 'month';
        const { startDate, endDate } = this.getLeaderboardWindow(period, query.startDate, query.endDate);

        // Active telecallers/agents
        const agents = await this.prisma.employee.findMany({
            where: {
                role: { code: { in: ['AGENT', 'MANAGER', 'FOUNDER'] } },
                status: 'ACTIVE',
                deletedAt: null,
            },
            select: {
                id: true,
                employeeCode: true,
                fullName: true,
                department: true,
                role: { select: { code: true } },
            },
        });

        // Compute metrics for each agent in parallel using pure database aggregations
        const agentStats = await Promise.all(
            agents.map(async (agent) => {
                const [calls, followUpsCompleted, followUpsPending, conversions] = await Promise.all([
                    this.prisma.call.findMany({
                        where: {
                            agentId: agent.id,
                            startedAt: { gte: startDate, lte: endDate },
                        },
                        select: {
                            status: true,
                            connectedAt: true,
                            endedAt: true,
                        },
                    }),
                    this.prisma.followUp.count({
                        where: {
                            agentId: agent.id,
                            status: 'COMPLETED',
                            completedAt: { gte: startDate, lte: endDate },
                        },
                    }),
                    this.prisma.followUp.count({
                        where: {
                            agentId: agent.id,
                            status: 'PENDING',
                        },
                    }),
                    this.prisma.relationshipOwnership.count({
                        where: {
                            assignedById: agent.id,
                            reason: 'conversion_sales',
                            assignedAt: { gte: startDate, lte: endDate },
                        },
                    }),
                ]);

                const callsDialed = calls.length;
                let callsConnected = 0;
                let totalTalkTimeSeconds = 0;

                for (const c of calls) {
                    if (c.status === 'CONNECTED' || (c.status === 'ENDED' && c.connectedAt)) {
                        callsConnected++;
                        if (c.endedAt && c.connectedAt) {
                            const dur = Math.max(0, Math.round((new Date(c.endedAt).getTime() - new Date(c.connectedAt).getTime()) / 1000));
                            totalTalkTimeSeconds += dur;
                        }
                    }
                }

                const conversionRate = callsDialed > 0 ? Number(((conversions / callsDialed) * 100).toFixed(1)) : 0;

                return {
                    agentId: agent.id,
                    employeeCode: agent.employeeCode || '—',
                    fullName: agent.fullName,
                    department: agent.department || 'Telecalling',
                    roleCode: agent.role.code,
                    callsDialed,
                    callsConnected,
                    totalTalkTimeSeconds,
                    followUpsCompleted,
                    followUpsPending,
                    leadsConverted: conversions,
                    conversionRate,
                    isCurrentAgent: agent.id === actor.id,
                };
            })
        );

        // Deterministic multi-attribute tie breaking
        agentStats.sort((a, b) => {
            if (b.callsConnected !== a.callsConnected) return b.callsConnected - a.callsConnected;
            if (b.leadsConverted !== a.leadsConverted) return b.leadsConverted - a.leadsConverted;
            if (b.followUpsCompleted !== a.followUpsCompleted) return b.followUpsCompleted - a.followUpsCompleted;
            if (b.totalTalkTimeSeconds !== a.totalTalkTimeSeconds) return b.totalTalkTimeSeconds - a.totalTalkTimeSeconds;
            return (a.employeeCode || '').localeCompare(b.employeeCode || '');
        });

        // Assign deterministic ranks
        const rankedLeaderboard = agentStats.map((item, idx) => ({
            rank: idx + 1,
            ...item,
        }));

        const currentAgentItem = rankedLeaderboard.find((i) => i.isCurrentAgent);

        return {
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalAgents: rankedLeaderboard.length,
            currentAgentRank: currentAgentItem?.rank ?? null,
            leaderboard: rankedLeaderboard,
        };
    }

    async exportLeaderboardCsv(actor, query = {}) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw ApiError.forbidden('LEADERBOARD_EXPORT_FORBIDDEN', 'Leaderboard export is restricted to management personnel');
        }

        const data = await this.getLeaderboard(actor, query);
        const columns = [
            { key: 'rank', header: 'Rank' },
            { key: 'employeeCode', header: 'Employee Code' },
            { key: 'fullName', header: 'Agent Name' },
            { key: 'department', header: 'Department' },
            { key: 'callsDialed', header: 'Calls Dialed' },
            { key: 'callsConnected', header: 'Calls Connected' },
            { key: 'totalTalkTimeSeconds', header: 'Total Talk Time (Seconds)' },
            { key: 'followUpsCompleted', header: 'Follow-Ups Completed' },
            { key: 'followUpsPending', header: 'Follow-Ups Pending' },
            { key: 'leadsConverted', header: 'Leads Converted' },
            { key: 'conversionRate', header: 'Conversion Rate (%)', format: (val) => `${val}%` },
        ];

        const csv = generateCsv(columns, data.leaderboard);
        return {
            filename: `grotec_leaderboard_${data.period}_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }
};

ReportsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], ReportsService);

export { ReportsService };
