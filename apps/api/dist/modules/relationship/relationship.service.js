"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const LIVE_PHONE = { deletedAt: null };
let RelationshipService = class RelationshipService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(actor, query = {}) {
        const unassigned = query.unassigned === '1' || query.unassigned === 'true';
        if (actor.roleCode === 'MANAGER' && query.rmId && query.rmId !== actor.id) {
            throw api_error_1.ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only view their own portfolio');
        }
        const ownerId = actor.roleCode === 'MANAGER' ? actor.id : query.rmId;
        if (unassigned) {
            if (actor.roleCode === 'AGENT')
                throw api_error_1.ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Not allowed');
            return this.listUnassigned(actor, ownerId, query.q);
        }
        const rows = await this.prisma.relationshipOwnership.findMany({
            where: {
                releasedAt: null,
                ...(ownerId ? { employeeId: ownerId } : {}),
                customer: {
                    is: {
                        deletedAt: null,
                        ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' } } : {}),
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
    async holders() {
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
                throw api_error_1.ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only reassign customers in their own portfolio or claim an unassigned customer to themselves');
            }
        }
        if (active?.employeeId === target.id) {
            return this.serializeAssignment(customerId, customer.fullName, {
                owner: { id: target.id, fullName: target.fullName },
                assignedAt: active.assignedAt,
                reason: active.reason,
            });
        }
        const reason = dto.reason?.trim() || (active ? 'reassigned' : 'conversion_claim');
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
                entityType: shared_1.AuditEntityType.RELATIONSHIP_OWNERSHIP,
                entityId: row.id,
                entityLabel: customer.fullName,
                action: shared_1.AuditAction.RELATIONSHIP_ASSIGNED,
                before: active ? { previousRmEmployeeId: active.employeeId } : undefined,
                after: { customerId, rmEmployeeId: target.id, reason },
            });
        });
        return this.serializeAssignment(customerId, customer.fullName, {
            owner: { id: target.id, fullName: target.fullName },
            assignedAt: new Date(),
            reason,
        });
    }
    async release(actor, customerId, dto) {
        const customer = await this.findCustomer(customerId);
        const active = await this.prisma.relationshipOwnership.findFirst({
            where: { customerId, releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
        });
        if (!active) {
            throw api_error_1.ApiError.conflict('RELATIONSHIP_NOT_ASSIGNED', 'This customer has no active relationship manager');
        }
        if (actor.roleCode === 'MANAGER' && active.employeeId !== actor.id) {
            throw api_error_1.ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only release ownership of their own customers');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.relationshipOwnership.updateMany({
                where: { id: active.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.RELATIONSHIP_OWNERSHIP,
                entityId: active.id,
                entityLabel: customer.fullName,
                action: shared_1.AuditAction.RELATIONSHIP_RELEASED,
                before: { customerId, rmEmployeeId: active.employeeId },
                after: { reason: dto.reason?.trim() ?? null },
            });
        });
        return { customerId, released: true, previousOwner: active.employee };
    }
    async listUnassigned(_actor, ownerId, q) {
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
            throw api_error_1.ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
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
            throw api_error_1.ApiError.badRequest('INVALID_RM_HOLDER', 'Only active Manager-role employees can hold relationship ownership');
        }
        return employee;
    }
};
exports.RelationshipService = RelationshipService;
exports.RelationshipService = RelationshipService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RelationshipService);
//# sourceMappingURL=relationship.service.js.map