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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const pagination_1 = require("../../common/utils/pagination");
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
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
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
        return (0, pagination_1.toPage)(items.map((lead) => ({
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
            throw api_error_1.ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        return serializeLead(lead);
    }
    async create(actor, input) {
        const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
        if (!customer)
            throw api_error_1.ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        if (customer.status === 'INACTIVE') {
            throw api_error_1.ApiError.badRequest('CUSTOMER_INACTIVE', 'A lead cannot be opened for an inactive customer');
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
                entityType: shared_1.AuditEntityType.LEAD,
                entityId: lead.id,
                entityLabel: customer.fullName,
                action: shared_1.AuditAction.CREATED,
                after: { customerId: customer.id, source: lead.source, status: client_1.LeadStatus.OPEN },
            });
            return lead.id;
        });
        return this.detailOrThrow(id, actor);
    }
    async update(actor, id, input) {
        const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null, AND: [this.scopeWhere(actor)] } });
        if (!lead)
            throw api_error_1.ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
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
                entityType: shared_1.AuditEntityType.LEAD,
                entityId: id,
                entityLabel: lead.id,
                action: shared_1.AuditAction.UPDATED,
                before: { source: lead.source, notes: lead.notes },
                after: { source: updated.source, notes: updated.notes },
            });
        });
        return this.detailOrThrow(id, actor);
    }
    async assign(actor, id, input) {
        const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null } });
        if (!lead)
            throw api_error_1.ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        const target = await this.prisma.employee.findFirst({
            where: { id: input.employeeId, deletedAt: null, status: client_1.EmployeeStatus.ACTIVE },
        });
        if (!target)
            throw api_error_1.ApiError.badRequest('EMPLOYEE_NOT_FOUND', 'Target employee is not active');
        const current = await this.prisma.leadOwnership.findFirst({
            where: { leadId: id, releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
        });
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
                entityType: shared_1.AuditEntityType.LEAD,
                entityId: id,
                entityLabel: lead.id,
                action: shared_1.AuditAction.OWNERSHIP_ASSIGNED,
                before: { ownerId: current?.employeeId ?? null },
                after: { ownerId: target.id, reason: input.reason ?? null },
            });
        });
        return this.detailOrThrow(id, actor);
    }
    async ownershipHistory(id, actor) {
        await this.detailOrThrow(id, actor);
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
    scopeWhere(actor) {
        if (actor.roleCode === 'AGENT') {
            return { ownerships: { some: { employeeId: actor.id, releasedAt: null } } };
        }
        return {};
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], LeadsService);
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
//# sourceMappingURL=leads.service.js.map