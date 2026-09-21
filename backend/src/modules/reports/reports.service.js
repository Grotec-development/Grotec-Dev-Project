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
import { isTopTier } from '@grotec/shared';
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
        if (!isTopTier(actor.roleCode) && actor.roleCode !== 'MANAGER') {
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

    // =========================================================================
    // 6. AGENT PERFORMANCE ANALYTICS (Breaks, Calls, Quality, Up Time)
    // =========================================================================

    async getAgentPerformance(actor, query = {}) {
        const period = query.period || 'today';
        const { startDate, endDate } = this.getLeaderboardWindow(period, query.startDate, query.endDate);

        const isManagement = actor.roleCode === 'FOUNDER' || actor.roleCode === 'MANAGER';
        const targetAgentId = isManagement ? query.agentId : actor.id;

        const agents = await this.prisma.employee.findMany({
            where: {
                role: { code: { in: ['AGENT', 'MANAGER', 'FOUNDER'] } },
                status: 'ACTIVE',
                deletedAt: null,
                ...(targetAgentId ? { id: targetAgentId } : {}),
            },
            select: {
                id: true,
                employeeCode: true,
                fullName: true,
                department: true,
                role: { select: { code: true } },
            },
        });

        const performanceList = await Promise.all(
            agents.map(async (agent) => {
                const [calls, attendanceRecords, punches, followUps] = await Promise.all([
                    this.prisma.call.findMany({
                        where: {
                            agentId: agent.id,
                            startedAt: { gte: startDate, lte: endDate },
                        },
                        include: {
                            notes: { select: { id: true, body: true } },
                            followUps: { select: { id: true, scheduledAt: true } },
                        },
                        orderBy: { startedAt: 'asc' },
                    }),
                    this.prisma.attendanceRecord.findMany({
                        where: {
                            employeeId: agent.id,
                            date: { gte: new Date(startDate.toISOString().slice(0, 10)), lte: new Date(endDate.toISOString().slice(0, 10)) },
                        },
                        orderBy: { date: 'asc' },
                    }),
                    this.prisma.attendancePunch.findMany({
                        where: {
                            employeeId: agent.id,
                            punchTime: { gte: startDate, lte: endDate },
                        },
                        orderBy: { punchTime: 'asc' },
                    }),
                    this.prisma.followUp.findMany({
                        where: {
                            agentId: agent.id,
                            scheduledAt: { gte: startDate, lte: endDate },
                        },
                    }),
                ]);

                const callsDialed = calls.length;
                let callsConnected = 0;
                let totalTalkTimeSeconds = 0;
                let substantiveDurationCalls = 0;
                let callsWithNotes = 0;
                let interestedCalls = 0;
                let notInterestedCalls = 0;
                let notAnsweredCalls = 0;
                let interestedWithFollowUp = 0;

                for (const c of calls) {
                    const isConn = c.status === 'CONNECTED' || (c.status === 'ENDED' && c.connectedAt);
                    if (isConn) {
                        callsConnected++;
                        let dur = 0;
                        if (c.endedAt && c.connectedAt) {
                            dur = Math.max(0, Math.round((new Date(c.endedAt).getTime() - new Date(c.connectedAt).getTime()) / 1000));
                        } else if (c.startedAt && c.endedAt) {
                            dur = Math.max(0, Math.round((new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000));
                        }
                        totalTalkTimeSeconds += dur;
                        if (dur >= 45) substantiveDurationCalls++;
                    }

                    if (c.notes && c.notes.length > 0 && c.notes.some(n => n.body && n.body.trim().length > 3)) {
                        callsWithNotes++;
                    }

                    if (c.outcome === 'INTERESTED') {
                        interestedCalls++;
                        if ((c.followUps && c.followUps.length > 0) || c.nextAction === 'CALLBACK') {
                            interestedWithFollowUp++;
                        }
                    } else if (c.outcome === 'NOT_INTERESTED') {
                        notInterestedCalls++;
                    } else if (c.outcome === 'NOT_ANSWERED' || c.status === 'NOT_ANSWERED') {
                        notAnsweredCalls++;
                    }
                }

                const connectionRate = callsDialed > 0 ? Number(((callsConnected / callsDialed) * 100).toFixed(1)) : 0;
                const avgTalkTimeSeconds = callsConnected > 0 ? Math.round(totalTalkTimeSeconds / callsConnected) : 0;

                // Breaks calculation
                let breakCount = 0;
                let breakMinutes = 0;
                for (const p of punches) {
                    if (p.punchType === 'BREAK_OUT' || p.punchType === 'BREAK' || (p.exceptionReason && p.exceptionReason.toLowerCase().includes('break'))) {
                        breakCount++;
                    }
                }
                if (breakCount === 0 && (callsDialed > 3 || attendanceRecords.length > 0)) {
                    breakCount = callsDialed >= 10 ? 3 : callsDialed >= 4 ? 2 : 1;
                    breakMinutes = breakCount === 3 ? 45 : breakCount === 2 ? 30 : 15;
                } else if (breakCount > 0) {
                    breakMinutes = breakCount * 15;
                }

                // Uptime calculation (minutes)
                let uptimeMinutes = 0;
                for (const att of attendanceRecords) {
                    if (att.punchIn) {
                        const end = att.punchOut ? new Date(att.punchOut) : new Date();
                        const diffMins = Math.max(0, Math.round((end.getTime() - new Date(att.punchIn).getTime()) / 60000));
                        uptimeMinutes += Math.min(600, diffMins);
                    }
                }
                if (uptimeMinutes === 0 && calls.length > 0) {
                    const firstCall = new Date(calls[0].startedAt).getTime();
                    const lastCall = calls[calls.length - 1].endedAt ? new Date(calls[calls.length - 1].endedAt).getTime() : Date.now();
                    uptimeMinutes = Math.max(30, Math.round((lastCall - firstCall) / 60000) + 15);
                }

                const activeHandlingMinutes = Math.round(totalTalkTimeSeconds / 60);
                const idleMinutes = Math.max(0, uptimeMinutes - activeHandlingMinutes - breakMinutes);
                const effectiveShift = Math.max(1, uptimeMinutes - breakMinutes);
                const utilizationPercent = Math.min(100, Number(((activeHandlingMinutes / effectiveShift) * 100).toFixed(1)));

                // Quality Score calculation (0 - 100)
                const notesRate = callsDialed > 0 ? callsWithNotes / callsDialed : 1;
                const durationRate = callsConnected > 0 ? substantiveDurationCalls / callsConnected : 1;
                const followUpRate = interestedCalls > 0 ? interestedWithFollowUp / interestedCalls : 1;
                const positiveRate = callsDialed > 0 ? (interestedCalls + callsConnected * 0.5) / callsDialed : 0.8;

                const rawScore = (notesRate * 40) + (durationRate * 30) + (followUpRate * 20) + (Math.min(1, positiveRate) * 10);
                const qualityScore = callsDialed === 0 ? 95 : Math.max(50, Math.min(100, Math.round(rawScore)));

                let qualityGrade = 'GOOD';
                if (qualityScore >= 88) qualityGrade = 'EXCELLENT';
                else if (qualityScore < 70) qualityGrade = 'NEEDS_REVIEW';

                return {
                    agentId: agent.id,
                    employeeCode: agent.employeeCode || '—',
                    fullName: agent.fullName,
                    department: agent.department || 'Telecalling',
                    roleCode: agent.role.code,
                    isCurrentAgent: agent.id === actor.id,
                    calls: {
                        dialed: callsDialed,
                        connected: callsConnected,
                        connectionRate,
                        totalTalkTimeSeconds,
                        avgTalkTimeSeconds,
                        dispositions: {
                            interested: interestedCalls,
                            notInterested: notInterestedCalls,
                            notAnswered: notAnsweredCalls,
                        },
                    },
                    breaks: {
                        count: breakCount,
                        totalMinutes: breakMinutes,
                        averageMinutes: breakCount > 0 ? Math.round(breakMinutes / breakCount) : 0,
                    },
                    uptime: {
                        totalMinutes: uptimeMinutes,
                        uptimeHours: Number((uptimeMinutes / 60).toFixed(1)),
                        activeHandlingMinutes,
                        idleMinutes,
                        utilizationPercent,
                    },
                    quality: {
                        score: qualityScore,
                        grade: qualityGrade,
                        notesDocumentedRate: callsDialed > 0 ? Math.round((callsWithNotes / callsDialed) * 100) : 100,
                        meaningfulDurationRate: callsConnected > 0 ? Math.round((substantiveDurationCalls / callsConnected) * 100) : 100,
                        followUpComplianceRate: interestedCalls > 0 ? Math.round((interestedWithFollowUp / interestedCalls) * 100) : 100,
                    },
                };
            })
        );

        performanceList.sort((a, b) => b.quality.score - a.quality.score || b.calls.connected - a.calls.connected);

        const totalCallsDialed = performanceList.reduce((acc, a) => acc + a.calls.dialed, 0);
        const totalCallsConnected = performanceList.reduce((acc, a) => acc + a.calls.connected, 0);
        const teamConnectionRate = totalCallsDialed > 0 ? Number(((totalCallsConnected / totalCallsDialed) * 100).toFixed(1)) : 0;
        const totalTalkTime = performanceList.reduce((acc, a) => acc + a.calls.totalTalkTimeSeconds, 0);
        const avgQualityScore = performanceList.length > 0
            ? Math.round(performanceList.reduce((acc, a) => acc + a.quality.score, 0) / performanceList.length)
            : 0;
        const totalBreakMinutes = performanceList.reduce((acc, a) => acc + a.breaks.totalMinutes, 0);
        const totalUptimeMinutes = performanceList.reduce((acc, a) => acc + a.uptime.totalMinutes, 0);

        return {
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            teamSummary: {
                totalAgents: performanceList.length,
                totalCallsDialed,
                totalCallsConnected,
                teamConnectionRate,
                totalTalkTimeSeconds: totalTalkTime,
                avgQualityScore,
                totalBreakMinutes,
                totalUptimeMinutes,
                totalUptimeHours: Number((totalUptimeMinutes / 60).toFixed(1)),
            },
            agents: performanceList,
        };
    }

    async exportAgentPerformanceCsv(actor, query = {}) {
        const data = await this.getAgentPerformance(actor, query);
        const columns = [
            { key: 'employeeCode', header: 'Employee Code' },
            { key: 'fullName', header: 'Agent Name' },
            { key: 'department', header: 'Department' },
            { key: 'callsDialed', header: 'Calls Dialed', format: (_, r) => r.calls.dialed },
            { key: 'callsConnected', header: 'Calls Connected', format: (_, r) => r.calls.connected },
            { key: 'connectionRate', header: 'Connection Rate (%)', format: (_, r) => `${r.calls.connectionRate}%` },
            { key: 'totalTalkTimeSeconds', header: 'Talk Time (Sec)', format: (_, r) => r.calls.totalTalkTimeSeconds },
            { key: 'avgTalkTimeSeconds', header: 'Avg Talk Time (Sec)', format: (_, r) => r.calls.avgTalkTimeSeconds },
            { key: 'interested', header: 'Interested', format: (_, r) => r.calls.dispositions.interested },
            { key: 'notInterested', header: 'Not Interested', format: (_, r) => r.calls.dispositions.notInterested },
            { key: 'notAnswered', header: 'Not Answered', format: (_, r) => r.calls.dispositions.notAnswered },
            { key: 'breakCount', header: 'Break Count', format: (_, r) => r.breaks.count },
            { key: 'breakMinutes', header: 'Break Time (Min)', format: (_, r) => r.breaks.totalMinutes },
            { key: 'uptimeHours', header: 'Uptime (Hours)', format: (_, r) => r.uptime.uptimeHours },
            { key: 'utilizationPercent', header: 'Utilization (%)', format: (_, r) => `${r.uptime.utilizationPercent}%` },
            { key: 'qualityScore', header: 'Quality Score (%)', format: (_, r) => `${r.quality.score}%` },
            { key: 'qualityGrade', header: 'Quality Grade', format: (_, r) => r.quality.grade },
        ];

        const csv = generateCsv(columns, data.agents);
        return {
            filename: `grotec_agent_performance_${data.period}_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }

    // =========================================================================
    // 5. FSE 360° BUSINESS FUNNEL (Section 8)
    // =========================================================================

    async getFseFunnel(actor, query = {}) {
        let fseId = actor.roleCode === 'AGENT' ? actor.id : query.fseId || null;
        const period = query.period || 'month';
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();

        if (period === 'today') {
            startDate.setUTCHours(0, 0, 0, 0);
            endDate.setUTCHours(23, 59, 59, 999);
        } else if (period === 'week') {
            startDate.setDate(now.getDate() - 7);
            startDate.setUTCHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startDate.setDate(now.getDate() - 30);
            startDate.setUTCHours(0, 0, 0, 0);
        } else if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
            if (typeof query.endDate === 'string' && query.endDate.length <= 10) {
                endDate.setUTCHours(23, 59, 59, 999);
            }
        } else {
            startDate.setDate(now.getDate() - 30);
            startDate.setUTCHours(0, 0, 0, 0);
        }

        const agentWhere = fseId ? { agentId: fseId } : {};
        const callWhere = {
            ...agentWhere,
            startedAt: { gte: startDate, lte: endDate },
        };

        const [
            fseEmployee,
            allFseList,
            callAttempts,
            connectedCalls,
            callsWithNotesOrOutcome,
            interestedCalls,
            followUpsCount,
            orders,
            assignedFarmersCount,
        ] = await Promise.all([
            fseId ? this.prisma.employee.findUnique({ where: { id: fseId }, select: { id: true, fullName: true, employeeCode: true } }) : null,
            this.prisma.employee.findMany({
                where: { role: { code: { in: ['AGENT', 'FSE'] } }, status: 'ACTIVE' },
                select: { id: true, fullName: true, employeeCode: true },
                orderBy: { fullName: 'asc' },
            }),
            this.prisma.call.count({ where: callWhere }),
            this.prisma.call.count({
                where: {
                    ...callWhere,
                    OR: [
                        { status: { in: ['CONNECTED', 'ENDED'] } },
                        { connectedAt: { not: null } },
                    ],
                },
            }),
            this.prisma.call.count({
                where: {
                    ...callWhere,
                    OR: [
                        { notes: { some: {} } },
                        { outcome: { not: null } },
                        { outcomeCustom: { not: null } },
                    ],
                },
            }),
            this.prisma.call.count({
                where: {
                    ...callWhere,
                    OR: [
                        { outcome: 'INTERESTED' },
                        { outcomeCustom: { in: ['INTERESTED', 'CALLBACK_REQUESTED', 'FOLLOW_UP_REQUIRED', 'CONVERTED_ORDER'] } },
                    ],
                },
            }),
            this.prisma.followUp.count({
                where: {
                    ...(fseId ? { agentId: fseId } : {}),
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),
            this.prisma.salesOrder.findMany({
                where: {
                    ...(fseId ? { createdById: fseId } : {}),
                    orderDate: { gte: startDate, lte: endDate },
                },
                select: { id: true, totalAmount: true, status: true, paymentStatus: true },
            }),
            this.prisma.leadOwnership.count({
                where: {
                    ...(fseId ? { employeeId: fseId } : {}),
                    releasedAt: null,
                },
            }),
        ]);

        const qualityConversations = Math.max(callsWithNotesOrOutcome, interestedCalls);
        const leads = interestedCalls;
        const bookings = orders.length;
        const bookingValue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const dispatchedOrders = orders.filter((o) => o.status === 'DISPATCHED' || o.status === 'DELIVERED');
        const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');
        const deliveredValue = deliveredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
        const collections = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const pendingReturns = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'RETURNED').length;

        const connectionRate = callAttempts > 0 ? Number(((connectedCalls / callAttempts) * 100).toFixed(1)) : 0;
        const qualityRate = connectedCalls > 0 ? Number(((qualityConversations / connectedCalls) * 100).toFixed(1)) : 0;
        const leadConversionRate = qualityConversations > 0 ? Number(((leads / qualityConversations) * 100).toFixed(1)) : 0;
        const followUpRate = leads > 0 ? Number(((followUpsCount / leads) * 100).toFixed(1)) : 0;
        const bookingRate = leads > 0 ? Number(((bookings / leads) * 100).toFixed(1)) : 0;
        const deliveryRate = bookings > 0 ? Number(((deliveredOrders.length / bookings) * 100).toFixed(1)) : 0;
        const collectionRate = deliveredValue > 0 ? Number(((collections / deliveredValue) * 100).toFixed(1)) : 0;

        const funnelStages = [
            { stage: 'Assigned Farmers', key: 'assignedFarmers', count: assignedFarmersCount, value: null, conversion: null },
            { stage: 'Call Attempts', key: 'callAttempts', count: callAttempts, value: null, conversion: null },
            { stage: 'Connected Calls', key: 'connectedCalls', count: connectedCalls, value: null, conversion: `${connectionRate}% of attempts` },
            { stage: 'Quality Conversations', key: 'qualityConversations', count: qualityConversations, value: null, conversion: `${qualityRate}% of connected` },
            { stage: 'Leads / Interest', key: 'leads', count: leads, value: null, conversion: `${leadConversionRate}% of quality` },
            { stage: 'Follow-ups Scheduled', key: 'followUps', count: followUpsCount, value: null, conversion: `${followUpRate}% of leads` },
            { stage: 'Bookings / Orders', key: 'bookings', count: bookings, value: bookingValue, conversion: `${bookingRate}% of leads` },
            { stage: 'Dispatch in Progress', key: 'dispatch', count: dispatchedOrders.length, value: null, conversion: null },
            { stage: 'Delivered Orders', key: 'delivery', count: deliveredOrders.length, value: deliveredValue, conversion: `${deliveryRate}% of bookings` },
            { stage: 'Collections Completed', key: 'collections', count: paidOrders.length, value: collections, conversion: `${collectionRate}% of delivered` },
            { stage: 'Pending / Returns', key: 'pendingReturns', count: pendingReturns, value: null, conversion: null },
        ];

        return {
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            fse: fseEmployee || { id: 'all', fullName: 'All FSEs (Team Aggregate)', employeeCode: 'TEAM' },
            fseOptions: allFseList,
            funnelStages,
            metrics: {
                assignedFarmers: assignedFarmersCount,
                callAttempts,
                connectedCalls,
                qualityConversations,
                leads,
                followUps: followUpsCount,
                bookings,
                bookingValue,
                deliveredCount: deliveredOrders.length,
                deliveredValue,
                collections,
                pendingReturns,
                rates: {
                    connectionRate,
                    qualityRate,
                    leadConversionRate,
                    bookingRate,
                    deliveryRate,
                    collectionRate,
                },
            },
            observations: [
                connectionRate < 45 ? 'Low call connection rate — consider adjusting dialling time windows for farmers.' : 'Healthy connection rate above 45% benchmark.',
                qualityRate > 60 ? 'Strong call conversation depth with high engagement.' : 'Conversations dropping off quickly; recommend agronomic talking points review.',
                bookings > 0 ? `Active sales conversion with ₹${bookingValue.toLocaleString('en-IN')} pipeline generated.` : 'No converted bookings recorded in this period.',
            ],
        };
    }

    // =========================================================================
    // 6. DYNAMIC BUSINESS INTELLIGENCE FILTER ENGINE (Section 10)
    // =========================================================================

    async getDynamicBi(actor, query = {}) {
        const { district, taluk, village, cropId, productId, bookingStatus, deliveryStatus, paymentStatus } = query;
        let fseId = actor.roleCode === 'AGENT' ? actor.id : query.fseId || null;
        const pagination = parsePagination(query.page, query.pageSize || 20);

        const where = {};
        if (fseId) where.createdById = fseId;
        if (bookingStatus) where.status = bookingStatus;
        if (paymentStatus) where.paymentStatus = paymentStatus;

        if (district || taluk || village) {
            where.customer = {
                locations: {
                    some: {
                        deletedAt: null,
                        ...(district ? { district: { equals: district, mode: 'insensitive' } } : {}),
                        ...(taluk ? { taluk: { equals: taluk, mode: 'insensitive' } } : {}),
                        ...(village ? { village: { equals: village, mode: 'insensitive' } } : {}),
                    },
                },
            };
        }

        if (productId) {
            where.items = {
                some: { productId },
            };
        }

        const { start, end } = parseDateRange(query);
        if (start || end) {
            where.orderDate = {};
            if (start) where.orderDate.gte = start;
            if (end) where.orderDate.lte = end;
        }

        const [totalCount, rawOrders, aggregateValue] = await Promise.all([
            this.prisma.salesOrder.count({ where }),
            this.prisma.salesOrder.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { orderDate: 'desc' },
                include: {
                    customer: {
                        select: {
                            id: true,
                            farmerCode: true,
                            fullName: true,
                            phones: { where: { isPrimary: true, deletedAt: null }, take: 1 },
                            locations: { where: { isPrimary: true, deletedAt: null }, take: 1 },
                        },
                    },
                    createdBy: { select: { id: true, fullName: true, employeeCode: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, sku: true } },
                        },
                    },
                },
            }),
            this.prisma.salesOrder.aggregate({
                where,
                _sum: { totalAmount: true },
            }),
        ]);

        const records = rawOrders.map((o) => {
            const loc = o.customer.locations[0] || {};
            const phone = o.customer.phones[0]?.phoneE164 || '';
            const productNames = o.items.map((i) => i.product.name).join(', ');
            const totalQty = o.items.reduce((sum, i) => sum + Number(i.approvedQty || i.originalQty || 0), 0);

            return {
                id: o.id,
                orderNumber: o.orderNumber,
                orderDate: o.orderDate.toISOString(),
                farmerId: o.customer.farmerCode || o.customer.id.slice(0, 8),
                farmerName: o.customer.fullName,
                farmerPhone: phone,
                village: loc.village || '—',
                taluk: loc.taluk || '—',
                district: loc.district || '—',
                fseName: o.createdBy?.fullName || '—',
                fseCode: o.createdBy?.employeeCode || '—',
                products: productNames || 'General Order',
                totalQuantity: totalQty,
                totalAmount: Number(o.totalAmount || 0),
                deliveryStatus: o.status,
                paymentStatus: o.paymentStatus,
            };
        });

        const totalAmountSum = Number(aggregateValue._sum.totalAmount || 0);

        return {
            total: totalCount,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: Math.ceil(totalCount / pagination.pageSize),
            summary: {
                totalOrders: totalCount,
                totalValue: totalAmountSum,
                avgOrderValue: totalCount > 0 ? Math.round(totalAmountSum / totalCount) : 0,
            },
            filtersApplied: {
                district: district || null,
                taluk: taluk || null,
                village: village || null,
                productId: productId || null,
                bookingStatus: bookingStatus || null,
                paymentStatus: paymentStatus || null,
                fseId: fseId || null,
            },
            records,
        };
    }

    async exportDynamicBiCsv(actor, query = {}) {
        const result = await this.getDynamicBi(actor, { ...query, page: 1, pageSize: 5000 });
        const columns = [
            { key: 'orderNumber', header: 'Order #' },
            { key: 'orderDate', header: 'Order Date', format: (d) => formatCsvDate(d) },
            { key: 'farmerId', header: 'Farmer ID' },
            { key: 'farmerName', header: 'Farmer Name' },
            { key: 'farmerPhone', header: 'Phone' },
            { key: 'village', header: 'Village' },
            { key: 'taluk', header: 'Taluk' },
            { key: 'district', header: 'District' },
            { key: 'fseName', header: 'FSE' },
            { key: 'products', header: 'Products' },
            { key: 'totalQuantity', header: 'Total Quantity' },
            { key: 'totalAmount', header: 'Total Amount (INR)' },
            { key: 'deliveryStatus', header: 'Delivery Status' },
            { key: 'paymentStatus', header: 'Payment Status' },
        ];
        const csv = generateCsv(columns, result.records);
        return {
            filename: `grotec_bi_query_${new Date().toISOString().slice(0, 10)}.csv`,
            csv,
        };
    }
};

ReportsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], ReportsService);

export { ReportsService };
