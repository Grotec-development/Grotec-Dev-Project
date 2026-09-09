var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, DOMAIN_EVENTS } from '@grotec/shared';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { DomainEventService } from '../../common/outbox/domain-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
const LIVE_PHONE = { deletedAt: null };
/**
 * Relationship (RM) ownership — a separate concept from agent lead ownership
 * (PRD §6.4, §11). One active RM per customer (partial unique index on
 * non-released rows). Eligible RM holders are ACTIVE MANAGER-role employees;
 * the Founder supervises. Assignment/reassignment rules are provisional and
 * recorded as open items where the PRD is silent.
 */
let RelationshipService = class RelationshipService {
    constructor(prisma, audit, domainEvents, customers) {
        this.prisma = prisma;
        this.audit = audit;
        this.domainEvents = domainEvents;
        this.customers = customers;
    }
    /**
     * RM workspace — customers under relationship ownership.
     * MANAGER: own portfolio only (ownership restriction); FOUNDER: all, with
     * optional rmId filter. `unassigned=1` lists converted customers (closed
     * leads) that have no active RM so they can be claimed/re-assigned.
     */
    async list(actor, query = {}) {
        const unassigned = query.unassigned === '1' || query.unassigned === 'true';
        if (actor.roleCode === 'MANAGER' && query.rmId && query.rmId !== actor.id) {
            throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only view their own portfolio');
        }
        const ownerId = actor.roleCode === 'MANAGER' ? actor.id : query.rmId;
        if (unassigned) {
            if (actor.roleCode === 'AGENT')
                throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Not allowed');
            return this.listUnassigned(actor, ownerId, query.q);
        }
        // AGENT may only see relationship rows for customers already visible to
        // them under the established CRM rule (created-by-me OR I currently own a
        // lead for them). CustomersService.visibilityWhere is the single source of
        // that rule and returns {} for every other role, so FOUNDER and MANAGER
        // behaviour is untouched.
        const customerScope = this.customers.visibilityWhere(actor);
        const rows = await this.prisma.relationshipOwnership.findMany({
            where: {
                releasedAt: null,
                ...(ownerId ? { employeeId: ownerId } : {}),
                customer: {
                    is: {
                        deletedAt: null,
                        ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' } } : {}),
                        AND: [customerScope],
                    },
                },
            },
            orderBy: { assignedAt: 'desc' },
            take: 200,
            include: {
                employee: { select: { id: true, fullName: true, email: true } },
                customer: {
                    include: {
                        phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                        locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                        crops: { where: { deletedAt: null }, include: { crop: { select: { id: true, name: true } } } },
                    },
                },
            },
        });
        const items = await Promise.all(rows.map(async (row) => {
            const customer = row.customer;
            if (!customer)
                return null;
            return this.serializePortfolioRow(row.id, customer, {
                owner: { id: row.employee.id, fullName: row.employee.fullName },
                assignedAt: row.assignedAt,
                reason: row.reason,
            });
        }));
        return { items: items.filter((item) => item !== null) };
    }
    /**
     * Employees eligible to hold RM ownership (ACTIVE MANAGER role), with load.
     * AGENT gets an empty list: this is company-wide management workload data and
     * agents cannot assign or release (relationship.manage is withheld), so the
     * narrowest safe scope is no holder list at all. The owning RM of a customer
     * the agent may already see is still returned by list() on that row.
     */
    async holders(actor) {
        if (actor?.roleCode === 'AGENT')
            return [];
        const managerRole = await this.prisma.role.findUnique({ where: { code: 'MANAGER' } });
        if (!managerRole)
            return [];
        const employees = await this.prisma.employee.findMany({
            where: { roleId: managerRole.id, status: 'ACTIVE' },
            select: { id: true, fullName: true, email: true },
            orderBy: { fullName: 'asc' },
        });
        const counts = await this.prisma.relationshipOwnership.groupBy({
            by: ['employeeId'],
            where: { releasedAt: null },
            _count: { _all: true },
        });
        const countBy = new Map(counts.map((c) => [c.employeeId, c._count._all]));
        return employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            email: e.email,
            customerCount: countBy.get(e.id) ?? 0,
        }));
    }
    /**
     * Assign or reassign an RM. FOUNDER may move any customer between eligible
     * holders; MANAGER may transfer customers in their own portfolio (or claim an
     * unassigned converted customer to themselves). Never touches other managers'
     * customers — ownership restrictions.
     */
    async assign(actor, customerId, dto) {
        const customer = await this.findCustomer(customerId);
        const target = await this.findEligibleHolder(dto.employeeId);
        const active = await this.prisma.relationshipOwnership.findFirst({
            where: { customerId, releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
        });
        if (actor.roleCode === 'MANAGER') {
            const owns = active?.employeeId === actor.id;
            const claimSelf = !active && dto.employeeId === actor.id;
            if (!owns && !claimSelf) {
                throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only reassign customers in their own portfolio or claim an unassigned customer to themselves');
            }
        }
        if (active?.employeeId === target.id) {
            // Idempotent — the requested holder already owns the customer.
            return this.serializeAssignment(customerId, customer.fullName, {
                owner: { id: target.id, fullName: target.fullName },
                assignedAt: active.assignedAt,
                reason: active.reason,
            });
        }
        const reason = dto.reason?.trim() || (active ? 'reassigned' : 'conversion_claim');
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.relationshipOwnership.updateMany({
                    where: { customerId, releasedAt: null },
                    data: { releasedAt: new Date() },
                });
                const row = await tx.relationshipOwnership.create({
                    data: {
                        customerId,
                        employeeId: target.id,
                        assignedById: actor.id,
                        reason,
                    },
                });
                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.RELATIONSHIP_OWNERSHIP,
                    entityId: row.id,
                    entityLabel: customer.fullName,
                    action: AuditAction.RELATIONSHIP_ASSIGNED,
                    before: active ? { previousRmEmployeeId: active.employeeId } : undefined,
                    after: { customerId, rmEmployeeId: target.id, reason },
                });
                await this.domainEvents.emit(tx, {
                    eventType: active ? DOMAIN_EVENTS.RELATIONSHIP_REASSIGNED : DOMAIN_EVENTS.RELATIONSHIP_ASSIGNED,
                    aggregateType: 'customer',
                    aggregateId: customerId,
                    actorId: actor.id,
                    payload: {
                        rmId: target.id,
                        previousRmId: active?.employeeId ?? null,
                        reason,
                    },
                });
            });
        }
        catch (err) {
            // P2002 on relationship_ownership_current_customer_idx — a concurrent
            // assign raced past our pre-check and now holds the active row. The
            // transaction is rolled back automatically (no partial ownership state).
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw ApiError.conflict('RELATIONSHIP_OWNERSHIP_CONFLICT', 'Customer ownership changed concurrently; please retry');
            }
            throw err;
        }
        return this.serializeAssignment(customerId, customer.fullName, {
            owner: { id: target.id, fullName: target.fullName },
            assignedAt: new Date(),
            reason,
        });
    }
    /** Release RM ownership (customer becomes unassigned). Founder: any; MANAGER: own. */
    async release(actor, customerId, dto) {
        const customer = await this.findCustomer(customerId);
        const active = await this.prisma.relationshipOwnership.findFirst({
            where: { customerId, releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
        });
        if (!active) {
            throw ApiError.conflict('RELATIONSHIP_NOT_ASSIGNED', 'This customer has no active relationship manager');
        }
        if (actor.roleCode === 'MANAGER' && active.employeeId !== actor.id) {
            throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only release ownership of their own customers');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.relationshipOwnership.updateMany({
                where: { id: active.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.RELATIONSHIP_OWNERSHIP,
                entityId: active.id,
                entityLabel: customer.fullName,
                action: AuditAction.RELATIONSHIP_RELEASED,
                before: { customerId, rmEmployeeId: active.employeeId },
                after: { reason: dto.reason?.trim() ?? null },
            });
            await this.domainEvents.emit(tx, {
                eventType: DOMAIN_EVENTS.RELATIONSHIP_RELEASED,
                aggregateType: 'customer',
                aggregateId: customerId,
                actorId: actor.id,
                payload: {
                    previousRmId: active.employeeId,
                    reason: dto.reason?.trim() ?? null,
                },
            });
        });
        return { customerId, released: true, previousOwner: active.employee };
    }
    // ------------------------------------------------------------------ helpers
    async listUnassigned(_actor, ownerId, q) {
        // Converted-but-unowned: customers whose latest non-deleted lead is CLOSED
        // (or that have an RM ownership history but no active row) with no active RM.
        const closedLeadCustomers = await this.prisma.lead.findMany({
            where: { deletedAt: null, status: 'CLOSED' },
            orderBy: { updatedAt: 'desc' },
            take: 500,
            select: { customerId: true },
            distinct: ['customerId'],
        });
        const ids = [...new Set(closedLeadCustomers.map((l) => l.customerId))];
        if (ids.length === 0)
            return { items: [] };
        const withOwner = await this.prisma.relationshipOwnership.findMany({
            where: { customerId: { in: ids }, releasedAt: null },
            select: { customerId: true },
        });
        const owned = new Set(withOwner.map((r) => r.customerId));
        const unownedIds = ids.filter((id) => !owned.has(id));
        // Manager claim scope: only themselves as target are relevant here, but the
        // list itself is shared (manager sees all unassigned converted customers).
        void ownerId;
        const customers = await this.prisma.customer.findMany({
            where: {
                id: { in: unownedIds },
                deletedAt: null,
                ...(q ? { fullName: { contains: q, mode: 'insensitive' } } : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
            include: {
                phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                crops: { where: { deletedAt: null }, include: { crop: { select: { id: true, name: true } } } },
                leads: {
                    where: { deletedAt: null, status: 'CLOSED' },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: { updatedAt: true },
                },
            },
        });
        const items = await Promise.all(customers.map(async (customer) => {
            const row = await this.serializePortfolioRow(null, customer, {
                owner: null,
                assignedAt: null,
                reason: null,
                convertedAt: customer.leads[0]?.updatedAt ?? null,
            });
            return row;
        }));
        return { items };
    }
    async serializePortfolioRow(ownershipRowId, customer, ownership) {
        const primaryPhone = customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
        const location = customer.locations.find((l) => l.isPrimary) ?? customer.locations[0];
        const [pendingFollowUps, lastCall] = await Promise.all([
            this.prisma.followUp.count({
                where: { customerId: customer.id, status: 'PENDING' },
            }),
            this.prisma.call.findFirst({
                where: { customerId: customer.id },
                orderBy: { startedAt: 'desc' },
                select: { id: true, status: true, outcome: true, nextAction: true, startedAt: true, phoneNumber: true },
            }),
        ]);
        return {
            ownershipRowId,
            customer: {
                id: customer.id,
                farmerCode: customer.farmerCode,
                fullName: customer.fullName,
                status: customer.status,
                primaryPhone: primaryPhone?.phoneE164 ?? null,
                location: location
                    ? { village: location.village, taluk: location.taluk, district: location.district, state: location.state }
                    : null,
                crops: customer.crops.map((c) => ({ id: c.id, cropId: c.crop.id, name: c.crop.name, acreage: c.acreage.toNumber(), unit: c.unit })),
            },
            owner: ownership.owner,
            assignedAt: ownership.assignedAt,
            reason: ownership.reason,
            convertedAt: ownership.convertedAt ?? null,
            pendingFollowUps,
            lastCall,
        };
    }
    serializeAssignment(customerId, customerName, ownership) {
        return {
            customerId,
            customerName,
            owner: ownership.owner,
            assignedAt: ownership.assignedAt,
            reason: ownership.reason,
        };
    }
    async findCustomer(customerId) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, deletedAt: null },
            select: { id: true, fullName: true },
        });
        if (!customer)
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        return customer;
    }
    async findEligibleHolder(employeeId) {
        const managerRole = await this.prisma.role.findUnique({ where: { code: 'MANAGER' } });
        const employee = managerRole
            ? await this.prisma.employee.findFirst({
                where: { id: employeeId, roleId: managerRole.id, status: 'ACTIVE' },
                select: { id: true, fullName: true },
            })
            : null;
        if (!employee) {
            throw ApiError.badRequest('INVALID_RM_HOLDER', 'Only active Manager-role employees can hold relationship ownership');
        }
        return employee;
    }
};
RelationshipService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof DomainEventService !== "undefined" && DomainEventService) === "function" ? _c : Object, typeof (_d = typeof CustomersService !== "undefined" && CustomersService) === "function" ? _d : Object])
], RelationshipService);
export { RelationshipService };
