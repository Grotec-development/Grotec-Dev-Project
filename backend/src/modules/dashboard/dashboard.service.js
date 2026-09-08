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
import { PrismaService } from '../../common/prisma/prisma.service';
export const PIPELINE_STATES = [
    'converted',
    'open',
    'interested',
    'not_interested',
    'never_reached',
];
/**
 * Telecaller dashboard summary — every number is computed from real CRM data
 * (PRD §6.2, Month 5). Agents get their own workload; Manager/Founder get the
 * team view. No mocked metrics.
 *
 * The `pipeline` array buckets farmers by their current CRM state, decided per
 * customer with a single-pass query and fixed precedence: converted (active RM
 * ownership) > open lead > latest outcome Interested > latest outcome Not
 * interested > never reached. Agents see farmers they created, called, or own
 * (any current or historical lead ownership); the team view covers everyone.
 */
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async summary(actor, range = 'day') {
        const isAgent = actor.roleCode === 'AGENT';
        const windowStart = this.windowStart(range);
        const callWhere = (extra = {}) => ({
            ...extra,
            ...(isAgent ? { agentId: actor.id } : {}),
        });
        const [dialedInWindow, connectedInWindow, endedInWindow, notAnsweredInWindow] = await Promise.all([
            this.prisma.call.count({ where: callWhere({ startedAt: { gte: windowStart } }) }),
            // "Connected" = a conversation that happened (ended by the agent after connecting).
            this.prisma.call.count({ where: callWhere({ startedAt: { gte: windowStart }, status: 'ENDED', connectedAt: { not: null } }) }),
            this.prisma.call.count({ where: callWhere({ startedAt: { gte: windowStart }, status: 'ENDED', endedAt: { not: null } }) }),
            this.prisma.call.count({ where: callWhere({ startedAt: { gte: windowStart }, status: 'NOT_ANSWERED' }) }),
        ]);
        const followUpWhere = (extra = {}) => ({
            ...extra,
            ...(isAgent ? { agentId: actor.id } : {}),
        });
        const [pendingFollowUps, overdueFollowUps, dueTodayFollowUps, completedInWindowFollowUps] = await Promise.all([
            this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING' }) }),
            this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING', dueAt: { lt: new Date() } }) }),
            this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING', dueAt: { gte: this.startOfToday(), lt: this.startOfTomorrow() } }) }),
            this.prisma.followUp.count({ where: followUpWhere({ status: 'COMPLETED', completedAt: { gte: windowStart } }) }),
        ]);
        const weekAgo = this.daysAgo(7);
        const ownedLeadWhere = (extra) => ({
            deletedAt: null,
            ...(isAgent ? { ownerships: { some: { employeeId: actor.id } } } : {}),
            ...extra,
        });
        const openLeadsWhere = ownedLeadWhere(isAgent ? { status: 'OPEN', ownerships: { some: { employeeId: actor.id, releasedAt: null } } } : { status: 'OPEN' });
        const closedLeadsWhere = ownedLeadWhere({ status: 'CLOSED' });
        const newLeadsWhere = ownedLeadWhere(isAgent
            ? { createdAt: { gte: weekAgo }, ownerships: { some: { employeeId: actor.id, releasedAt: null } } }
            : { createdAt: { gte: weekAgo } });
        const [openLeads, closedLeads, newLeads, customersTotal, convertedCustomers, interestedCustomers, segmented] = await Promise.all([
            this.prisma.lead.count({ where: openLeadsWhere }),
            this.prisma.lead.count({ where: closedLeadsWhere }),
            this.prisma.lead.count({ where: newLeadsWhere }),
            this.countVisibleCustomers(actor),
            this.countConvertedCustomers(actor),
            this.countInterestedCustomers(actor),
            this.segmentPipeline(actor),
        ]);
        const recent = await this.prisma.call.findMany({
            where: callWhere(),
            orderBy: { startedAt: 'desc' },
            take: 8,
            select: {
                id: true,
                phoneNumber: true,
                status: true,
                outcome: true,
                startedAt: true,
                customer: { select: { fullName: true } },
            },
        });
        return {
            scope: isAgent ? 'me' : 'team',
            window: range,
            calls: {
                dialedToday: dialedInWindow,
                connectedToday: connectedInWindow,
                completedToday: endedInWindow,
                notAnsweredToday: notAnsweredInWindow,
            },
            followUps: {
                pending: pendingFollowUps,
                overdue: overdueFollowUps,
                dueToday: dueTodayFollowUps,
                completedToday: completedInWindowFollowUps,
            },
            leads: {
                open: openLeads,
                closedTotal: closedLeads,
                newThisWeek: newLeads,
            },
            customers: {
                total: customersTotal,
                converted: convertedCustomers,
                interested: interestedCustomers,
            },
            pipeline: PIPELINE_STATES.map((state) => ({ state, count: segmented.counts[state] ?? 0 })),
            pipelineTotal: segmented.counts.total,
            recentActivity: recent.map((call) => ({
                kind: 'call',
                id: call.id,
                customerName: call.customer?.fullName ?? null,
                phoneNumber: call.phoneNumber,
                status: call.status,
                outcome: call.outcome,
                startedAt: call.startedAt,
            })),
        };
    }
    /** Drill-down for one pipeline slice: the matching farmers for this role. */
    async pipeline(actor, state) {
        if (!PIPELINE_STATES.includes(state)) {
            state = 'never_reached';
        }
        const segmented = await this.segmentPipeline(actor);
        const ids = segmented.byState[state] ?? [];
        if (ids.length === 0)
            return { state, items: [] };
        const customers = await this.prisma.customer.findMany({
            where: { id: { in: ids } },
            orderBy: { fullName: 'asc' },
            take: 60,
            select: {
                id: true,
                farmerCode: true,
                fullName: true,
                status: true,
                phones: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], take: 1, select: { phoneE164: true } },
                locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], take: 1, select: { village: true, taluk: true, district: true, state: true } },
                crops: { where: { deletedAt: null }, select: { acreage: true, unit: true, crop: { select: { name: true } } } },
            },
        });
        const itemMap = new Map(customers.map((c) => [c.id, c]));
        // Preserve pipeline ordering (most relevant first) rather than alphabetical.
        const ordered = ids
            .map((id) => itemMap.get(id))
            .filter((c) => Boolean(c))
            .slice(0, 60);
        return {
            state,
            total: ids.length,
            items: ordered.map((customer) => ({
                id: customer.id,
                farmerCode: customer.farmerCode,
                fullName: customer.fullName,
                status: customer.status,
                primaryPhone: customer.phones[0]?.phoneE164 ?? null,
                location: customer.locations[0]
                    ? {
                        village: customer.locations[0].village,
                        taluk: customer.locations[0].taluk,
                        district: customer.locations[0].district,
                        state: customer.locations[0].state,
                    }
                    : null,
                crops: customer.crops.map((c) => ({ name: c.crop.name, acreage: c.acreage.toNumber(), unit: c.unit })),
            })),
        };
    }
    // --------------------------------------------------------------- internals
    /**
     * Single-pass per-customer segmentation (precedence decided in SQL):
     * converted → open → interested → not_interested → never_reached.
     */
    async segmentPipeline(actor) {
        const rows = await this.prisma.$queryRawUnsafe(this.pipelineSql(actor), ...this.pipelineParams(actor));
        const byState = {
            converted: [],
            open: [],
            interested: [],
            not_interested: [],
            never_reached: [],
        };
        for (const row of rows) {
            const state = PIPELINE_STATES.includes(row.state) ? row.state : 'never_reached';
            byState[state].push(row.id);
        }
        const counts = { total: rows.length };
        for (const state of PIPELINE_STATES)
            counts[state] = byState[state].length;
        return { counts, byState };
    }
    pipelineSql(actor) {
        if (actor.roleCode === 'AGENT') {
            return `
        SELECT c.id AS id,
          CASE
            WHEN rm.customer_id IS NOT NULL THEN 'converted'
            WHEN EXISTS (
              SELECT 1 FROM leads l
              JOIN lead_ownership lo ON lo.lead_id = l.id
              WHERE l.customer_id = c.id AND l.deleted_at IS NULL AND l.status = 'OPEN'
                AND lo.employee_id = $2::uuid AND lo.released_at IS NULL
            ) THEN 'open'
            WHEN lc.outcome = 'INTERESTED' THEN 'interested'
            WHEN lc.outcome = 'NOT_INTERESTED' THEN 'not_interested'
            ELSE 'never_reached'
          END AS state
        FROM customers c
        LEFT JOIN LATERAL (
          SELECT ca.outcome FROM calls ca
          WHERE ca.customer_id = c.id AND ca.outcome IS NOT NULL
          ORDER BY ca.started_at DESC LIMIT 1
        ) lc ON TRUE
        LEFT JOIN relationship_ownership rm ON rm.customer_id = c.id AND rm.released_at IS NULL
        WHERE c.deleted_at IS NULL AND (
          c.created_by = $1::uuid
          OR EXISTS (
            SELECT 1 FROM lead_ownership lo0
            JOIN leads l0 ON l0.id = lo0.lead_id
            WHERE l0.customer_id = c.id AND lo0.employee_id = $1::uuid
          )
          OR EXISTS (SELECT 1 FROM calls ca0 WHERE ca0.customer_id = c.id AND ca0.agent_id = $1::uuid)
        )`;
        }
        return `
      SELECT c.id AS id,
        CASE
          WHEN rm.customer_id IS NOT NULL THEN 'converted'
          WHEN EXISTS (
            SELECT 1 FROM leads l
            WHERE l.customer_id = c.id AND l.deleted_at IS NULL AND l.status = 'OPEN'
          ) THEN 'open'
          WHEN lc.outcome = 'INTERESTED' THEN 'interested'
          WHEN lc.outcome = 'NOT_INTERESTED' THEN 'not_interested'
          ELSE 'never_reached'
        END AS state
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT ca.outcome FROM calls ca
        WHERE ca.customer_id = c.id AND ca.outcome IS NOT NULL
        ORDER BY ca.started_at DESC LIMIT 1
      ) lc ON TRUE
      LEFT JOIN relationship_ownership rm ON rm.customer_id = c.id AND rm.released_at IS NULL
      WHERE c.deleted_at IS NULL`;
    }
    pipelineParams(actor) {
        return actor.roleCode === 'AGENT' ? [actor.id, actor.id] : [];
    }
    windowStart(range) {
        if (range === 'week')
            return this.daysAgo(7);
        if (range === 'month')
            return this.daysAgo(30);
        return this.startOfToday();
    }
    startOfToday() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    startOfTomorrow() {
        return new Date(this.startOfToday().getTime() + 24 * 60 * 60 * 1000);
    }
    daysAgo(n) {
        return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    }
    async countVisibleCustomers(actor) {
        if (actor.roleCode === 'AGENT') {
            return this.prisma.customer.count({
                where: {
                    deletedAt: null,
                    OR: [
                        { createdById: actor.id },
                        { leads: { some: { deletedAt: null, ownerships: { some: { employeeId: actor.id, releasedAt: null } } } } },
                    ],
                },
            });
        }
        return this.prisma.customer.count({ where: { deletedAt: null } });
    }
    /** Customers converted to relationship ownership (active RM row). */
    async countConvertedCustomers(actor) {
        if (actor.roleCode === 'AGENT') {
            // Farmers the agent moved to sales: customers with a CLOSED lead this
            // agent historically owned (lead ownership history is append-only).
            const customerIds = await this.prisma.lead.findMany({
                where: {
                    deletedAt: null,
                    status: 'CLOSED',
                    ownerships: { some: { employeeId: actor.id } },
                },
                distinct: ['customerId'],
                select: { customerId: true },
            });
            return customerIds.length;
        }
        return this.prisma.relationshipOwnership.count({ where: { releasedAt: null } });
    }
    /** Distinct customers with at least one Interested call outcome. */
    async countInterestedCustomers(actor) {
        const calls = await this.prisma.call.findMany({
            where: {
                outcome: 'INTERESTED',
                ...(actor.roleCode === 'AGENT' ? { agentId: actor.id } : {}),
            },
            distinct: ['customerId'],
            select: { customerId: true },
        });
        return calls.filter((c) => c.customerId !== null).length;
    }
};
DashboardService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], DashboardService);
export { DashboardService };
export function toDashboardRange(value) {
    if (value === 'week' || value === 'month')
        return value;
    return 'day';
}
export function toPipelineState(value) {
    if (value && PIPELINE_STATES.includes(value))
        return value;
    return 'never_reached';
}
