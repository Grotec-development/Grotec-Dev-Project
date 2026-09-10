var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntityType, DOMAIN_EVENTS, EmployeeStatus, LeadStatus } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { DomainEventService } from '../../common/outbox/domain-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
import { computeLeadWorkloadPlan } from './lead-balancer.util';
const LEAD_DETAIL_INCLUDE = {
    customer: {
        select: {
            id: true,
            fullName: true,
            status: true,
            phones: {
                where: { deletedAt: null },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                take: 1,
                select: { phoneE164: true },
            },
        },
    },
    ownerships: {
        orderBy: { assignedAt: 'desc' },
        include: {
            employee: { select: { id: true, fullName: true } },
            assignedBy: { select: { id: true, fullName: true } },
        },
    },
};
let LeadsService = class LeadsService {
    constructor(prisma, audit, domainEvents) {
        this.prisma = prisma;
        this.audit = audit;
        this.domainEvents = domainEvents;
    }
    async list(actor, pagination, filters) {
        const conditions = [{ deletedAt: null }, this.scopeWhere(actor)];
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.ownerId) {
            conditions.push({ ownerships: { some: { employeeId: filters.ownerId, releasedAt: null } } });
        }
        if (filters.q) {
            conditions.push({ customer: { fullName: { contains: filters.q, mode: 'insensitive' } } });
        }
        const where = { AND: conditions };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.lead.findMany({
                where,
                include: {
                    customer: { select: { id: true, fullName: true, status: true } },
                    ownerships: {
                        where: { releasedAt: null },
                        include: { employee: { select: { id: true, fullName: true } } },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
            }),
            this.prisma.lead.count({ where }),
        ]);
        return toPage(items.map((lead) => ({
            id: lead.id,
            customer: lead.customer,
            status: lead.status,
            source: lead.source,
            notes: lead.notes,
            createdAt: lead.createdAt,
            owner: lead.ownerships[0]?.employee ?? null,
        })), total, pagination);
    }
    async detailOrThrow(id, actor) {
        const lead = await this.prisma.lead.findFirst({
            where: { id, deletedAt: null, AND: [this.scopeWhere(actor)] },
            include: LEAD_DETAIL_INCLUDE,
        });
        if (!lead)
            throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        return serializeLead(lead);
    }
    async create(actor, input) {
        const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
        if (!customer)
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        if (customer.status === 'INACTIVE') {
            throw ApiError.badRequest('CUSTOMER_INACTIVE', 'A lead cannot be opened for an inactive customer');
        }
        const id = await this.prisma.$transaction(async (tx) => {
            const lead = await tx.lead.create({
                data: {
                    customerId: input.customerId,
                    source: input.source?.trim() ? input.source.trim() : null,
                    notes: input.notes ?? null,
                    createdById: actor.id,
                },
            });
            await tx.leadOwnership.create({
                data: {
                    leadId: lead.id,
                    employeeId: actor.id,
                    assignedById: actor.id,
                    reason: 'auto-assigned to creator',
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.LEAD,
                entityId: lead.id,
                entityLabel: customer.fullName,
                action: AuditAction.CREATED,
                after: { customerId: customer.id, source: lead.source, status: LeadStatus.OPEN },
            });
            await this.domainEvents.emit(tx, {
                eventType: DOMAIN_EVENTS.LEAD_CREATED,
                aggregateType: 'lead',
                aggregateId: lead.id,
                actorId: actor.id,
                payload: { customerId: customer.id, source: lead.source, ownerId: actor.id },
            });
            return lead.id;
        });
        return this.detailOrThrow(id, actor);
    }
    async update(actor, id, input) {
        const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null, AND: [this.scopeWhere(actor)] } });
        if (!lead)
            throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        await this.prisma.$transaction(async (tx) => {
            const updated = await tx.lead.update({
                where: { id },
                data: {
                    source: input.source === undefined ? undefined : input.source?.trim() ? input.source.trim() : null,
                    notes: input.notes === undefined ? undefined : input.notes,
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.LEAD,
                entityId: id,
                entityLabel: lead.id,
                action: AuditAction.UPDATED,
                before: { source: lead.source, notes: lead.notes },
                after: { source: updated.source, notes: updated.notes },
            });
        });
        return this.detailOrThrow(id, actor);
    }
    async assign(actor, id, input) {
        const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null } });
        if (!lead)
            throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        const target = await this.prisma.employee.findFirst({
            where: { id: input.employeeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
        });
        if (!target)
            throw ApiError.badRequest('EMPLOYEE_NOT_FOUND', 'Target employee is not active');
        const current = await this.prisma.leadOwnership.findFirst({
            where: { leadId: id, releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
        });
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.leadOwnership.updateMany({ where: { leadId: id, releasedAt: null }, data: { releasedAt: new Date() } });
                await tx.leadOwnership.create({
                    data: {
                        leadId: id,
                        employeeId: target.id,
                        assignedById: actor.id,
                        reason: input.reason?.trim() ? input.reason.trim() : null,
                    },
                });
                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.LEAD,
                    entityId: id,
                    entityLabel: lead.id,
                    action: AuditAction.OWNERSHIP_ASSIGNED,
                    before: { ownerId: current?.employeeId ?? null },
                    after: { ownerId: target.id, reason: input.reason ?? null },
                });
                await this.domainEvents.emit(tx, {
                    eventType: current ? DOMAIN_EVENTS.LEAD_REASSIGNED : DOMAIN_EVENTS.LEAD_ASSIGNED,
                    aggregateType: 'lead',
                    aggregateId: id,
                    actorId: actor.id,
                    payload: {
                        ownerId: target.id,
                        previousOwnerId: current?.employeeId ?? null,
                        reason: input.reason ?? null,
                    },
                });
            });
        }
        catch (err) {
            // P2002 on lead_ownership_current_lead_idx — a concurrent assign raced
            // past our pre-check and now holds the active row. The transaction is
            // rolled back automatically (no partial ownership state).
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw ApiError.conflict('LEAD_OWNERSHIP_CONFLICT', 'Lead ownership changed concurrently; please retry');
            }
            throw err;
        }
        return this.detailOrThrow(id, actor);
    }
    async ownershipHistory(id, actor) {
        await this.detailOrThrow(id, actor); // scoping + existence
        const rows = await this.prisma.leadOwnership.findMany({
            where: { leadId: id },
            orderBy: { assignedAt: 'desc' },
            include: {
                employee: { select: { id: true, fullName: true } },
                assignedBy: { select: { id: true, fullName: true } },
            },
        });
        return rows.map((row) => ({
            id: row.id,
            owner: row.employee,
            assignedBy: row.assignedBy,
            reason: row.reason,
            assignedAt: row.assignedAt,
            releasedAt: row.releasedAt,
            isCurrent: row.releasedAt === null,
        }));
    }
    async rebalanceWorkload(actor, options = {}) {
        const dryRun = options.dryRun !== false;
        const limit = options.limit ?? 1000;
        const eligibleAgents = await this.prisma.employee.findMany({
            where: {
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
                role: { code: 'AGENT' },
            },
            select: { id: true, fullName: true, status: true },
            orderBy: { id: 'asc' },
        });
        const leads = await this.prisma.lead.findMany({
            where: {
                status: LeadStatus.OPEN,
                deletedAt: null,
            },
            include: {
                customer: { select: { id: true, fullName: true } },
                ownerships: {
                    where: { releasedAt: null },
                    include: { employee: { select: { id: true, fullName: true, status: true } } },
                },
                callSessions: {
                    select: { id: true, scheduledAt: true, status: true },
                    where: { status: 'SCHEDULED' },
                },
            },
            take: limit,
            orderBy: { createdAt: 'asc' },
        });
        const normalizedLeads = leads.map((l) => ({
            id: l.id,
            customerId: l.customerId,
            currentOwnerId: l.ownerships[0]?.employeeId ?? null,
            hasPendingFollowUp: (l.callSessions?.length ?? 0) > 0,
        }));
        const callHistory = await this.prisma.callSession.findMany({
            where: {
                status: 'ENDED',
                connectedAt: { not: null },
            },
            select: {
                customerId: true,
                employeeId: true,
                endedAt: true,
                connectedAt: true,
            },
            orderBy: { endedAt: 'desc' },
            take: 5000,
        });
        const plan = computeLeadWorkloadPlan({
            agents: eligibleAgents,
            leads: normalizedLeads,
            callHistory,
            options,
        });
        if (!dryRun && plan.deltaAssignments.length > 0) {
            await this.prisma.$transaction(async (tx) => {
                for (const delta of plan.deltaAssignments) {
                    await tx.leadOwnership.updateMany({
                        where: { leadId: delta.leadId, releasedAt: null },
                        data: { releasedAt: new Date() },
                    });
                    await tx.leadOwnership.create({
                        data: {
                            leadId: delta.leadId,
                            employeeId: delta.targetAgentId,
                            assignedById: actor.id,
                            reason: `Workload rebalancing (${delta.reason})`,
                        },
                    });
                    await this.audit.record(tx, {
                        actorId: actor.id,
                        entityType: AuditEntityType.LEAD,
                        entityId: delta.leadId,
                        action: AuditAction.OWNERSHIP_ASSIGNED,
                        after: { ownerId: delta.targetAgentId, reason: delta.reason },
                    });
                }
            });
        }
        return {
            dryRun,
            plan,
        };
    }
    /** Agents see only leads they currently own. (STAFF/MANAGER/FOUNDER: all.) */
    scopeWhere(actor) {
        if (actor.roleCode === 'AGENT') {
            return { ownerships: { some: { employeeId: actor.id, releasedAt: null } } };
        }
        return {};
    }
};
LeadsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof DomainEventService !== "undefined" && DomainEventService) === "function" ? _c : Object])
], LeadsService);
export { LeadsService };
function serializeLead(lead) {
    const ownershipHistory = lead.ownerships.map((row) => ({
        id: row.id,
        owner: row.employee,
        assignedBy: row.assignedBy,
        reason: row.reason,
        assignedAt: row.assignedAt,
        releasedAt: row.releasedAt,
        isCurrent: row.releasedAt === null,
    }));
    return {
        id: lead.id,
        customer: {
            id: lead.customer.id,
            fullName: lead.customer.fullName,
            status: lead.customer.status,
            primaryPhone: lead.customer.phones[0]?.phoneE164 ?? null,
        },
        status: lead.status,
        source: lead.source,
        notes: lead.notes,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        currentOwner: ownershipHistory.find((row) => row.isCurrent)?.owner ?? null,
        ownershipHistory,
    };
}
