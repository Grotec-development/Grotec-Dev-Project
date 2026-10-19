var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantId } from '../../common/utils/tenant-scope';
import { isTopTier } from '@grotec/shared';

const TICKET_INCLUDE = {
    customer: {
        select: {
            id: true,
            farmerCode: true,
            fullName: true,
            phones: { where: { deletedAt: null }, select: { phoneE164: true, isPrimary: true } },
            locations: { where: { deletedAt: null }, select: { district: true, taluk: true, village: true } },
        },
    },
    assignee: { select: { id: true, fullName: true, employeeCode: true, role: { select: { code: true } } } },
    createdBy: { select: { id: true, fullName: true, employeeCode: true } },
    call: { select: { id: true, phoneNumber: true, startedAt: true } },
    history: {
        include: {
            actor: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
    },
};

let SupportTicketsService = class SupportTicketsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async list(actor, query = {}) {
        const where = {};
        if (query.customerId) where.customerId = query.customerId;
        if (query.status) where.status = query.status;
        if (query.category) where.category = query.category;
        if (query.priority) where.priority = query.priority;
        if (query.assigneeId) where.assigneeId = query.assigneeId;

        // Overdue filter: due date in the past and not yet resolved/closed
        if (query.overdue === 'true' || query.overdue === '1') {
            where.dueDate = { lt: new Date() };
            where.status = { notIn: ['RESOLVED', 'CLOSED'] };
        }

        // If regular agent without manager/founder rank, they see tickets they created OR assigned to them
        if (actor.roleCode === 'AGENT' && !isTopTier(actor.roleCode)) {
            where.OR = [
                { createdById: actor.id },
                { assigneeId: actor.id },
            ];
        }

        return this.prisma.supportTicket.findMany({
            where,
            include: TICKET_INCLUDE,
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async getById(actor, id) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id },
            include: TICKET_INCLUDE,
        });
        if (!ticket) {
            throw ApiError.notFound('TICKET_NOT_FOUND', `Support ticket ${id} not found`);
        }
        return ticket;
    }

    async create(actor, data) {
        if (!data.customerId) {
            throw ApiError.badRequest('CUSTOMER_REQUIRED', 'Customer ID is required to raise a ticket');
        }
        if (!data.description || !data.description.trim()) {
            throw ApiError.badRequest('DESCRIPTION_REQUIRED', 'Ticket description is required');
        }

        const customer = await this.prisma.customer.findUnique({
            where: { id: data.customerId, deletedAt: null },
            select: { id: true, fullName: true },
        });
        if (!customer) {
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        }

        const tenantId = await resolveTenantId(this.prisma, actor);
        const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const ticketNumber = `TCK-${dateCode}-${randomNum}`;

        // Default due date: 48 hours for normal, 24 hours for HIGH, 12 hours for URGENT
        const hoursToAdd = data.priority === 'URGENT' ? 12 : data.priority === 'HIGH' ? 24 : 48;
        const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + hoursToAdd * 3600 * 1000);

        let initialStatus = 'OPEN';
        let assigneeId = data.assigneeId || null;

        // Auto-assign to Team Leader / Manager if category dictates
        if (!assigneeId && (data.category === 'MD_REQUEST' || data.category === 'MANAGEMENT_REQUEST')) {
            const founder = await this.prisma.employee.findFirst({
                where: { role: { code: 'FOUNDER' }, status: 'ACTIVE', deletedAt: null },
                select: { id: true },
            });
            assigneeId = founder?.id || null;
            if (assigneeId) initialStatus = 'ASSIGNED';
        } else if (assigneeId) {
            initialStatus = 'ASSIGNED';
        }

        return this.prisma.$transaction(async (tx) => {
            const ticket = await tx.supportTicket.create({
                data: {
                    tenantId,
                    ticketNumber,
                    customerId: data.customerId,
                    callId: data.callId || null,
                    category: data.category || 'OTHER',
                    description: data.description.trim(),
                    priority: data.priority || 'MEDIUM',
                    status: initialStatus,
                    assignedRole: data.assignedRole || null,
                    assigneeId,
                    createdById: actor.id,
                    dueDate,
                },
            });

            await tx.supportTicketHistory.create({
                data: {
                    ticketId: ticket.id,
                    actorId: actor.id,
                    action: 'CREATED',
                    fromStatus: null,
                    toStatus: initialStatus,
                    note: `Ticket raised by ${actor.fullName || 'Agent'}${assigneeId ? ' and assigned' : ''}`,
                },
            });

            // Persist notification for assignee
            if (assigneeId) {
                await tx.appNotification.create({
                    data: {
                        recipientId: assigneeId,
                        type: 'EMPLOYEE_REQUEST_SUBMITTED',
                        title: `New Escalation Ticket: ${ticketNumber}`,
                        message: `Customer ${customer.fullName} - ${data.category}: ${data.description.slice(0, 100)}`,
                        data: { ticketId: ticket.id, ticketNumber },
                    },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SUPPORT_TICKET',
                entityId: ticket.id,
                entityLabel: ticketNumber,
                action: 'created',
                after: { ticketNumber, category: data.category, priority: data.priority, customerId: data.customerId },
            });

            return tx.supportTicket.findUnique({
                where: { id: ticket.id },
                include: TICKET_INCLUDE,
            });
        }, { timeout: 25000, maxWait: 15000 });
    }

    async assign(actor, id, data) {
        const ticket = await this.getById(actor, id);
        const assignee = await this.prisma.employee.findUnique({
            where: { id: data.assigneeId, status: 'ACTIVE', deletedAt: null },
            select: { id: true, fullName: true, role: { select: { code: true } } },
        });
        if (!assignee) {
            throw ApiError.notFound('ASSIGNEE_NOT_FOUND', 'Assigned employee not found or inactive');
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.supportTicket.update({
                where: { id },
                data: {
                    assigneeId: assignee.id,
                    status: 'ASSIGNED',
                    assignedRole: data.assignedRole || assignee.role?.code || null,
                },
            });

            await tx.supportTicketHistory.create({
                data: {
                    ticketId: id,
                    actorId: actor.id,
                    action: 'ASSIGNED',
                    fromStatus: ticket.status,
                    toStatus: 'ASSIGNED',
                    note: `Assigned to ${assignee.fullName}${data.note ? ': ' + data.note : ''}`,
                },
            });

            await tx.appNotification.create({
                data: {
                    recipientId: assignee.id,
                    type: 'EMPLOYEE_REQUEST_SUBMITTED',
                    title: `Ticket Assigned: ${ticket.ticketNumber}`,
                    message: `You were assigned ticket ${ticket.ticketNumber} for farmer ${ticket.customer?.fullName || ''}`,
                    data: { ticketId: id },
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SUPPORT_TICKET',
                entityId: id,
                entityLabel: ticket.ticketNumber,
                action: 'assigned',
                after: { assigneeId: assignee.id, assigneeName: assignee.fullName },
            });

            return tx.supportTicket.findUnique({
                where: { id },
                include: TICKET_INCLUDE,
            });
        }, { timeout: 25000, maxWait: 15000 });
    }

    async updateStatus(actor, id, data) {
        const ticket = await this.getById(actor, id);
        const newStatus = data.status;

        if (ticket.status === 'CLOSED' && !isTopTier(actor.roleCode) && actor.roleCode !== 'MANAGER') {
            throw ApiError.forbidden('CLOSED_TICKET_IMMUTABLE', 'Only managers can reopen or modify closed tickets');
        }

        return this.prisma.$transaction(async (tx) => {
            const updatePayload = { status: newStatus };
            if (newStatus === 'RESOLVED') {
                updatePayload.resolvedAt = new Date();
                if (data.resolutionNotes) updatePayload.resolutionNotes = data.resolutionNotes;
            } else if (newStatus === 'CLOSED') {
                updatePayload.closedAt = new Date();
                if (data.resolutionNotes) updatePayload.resolutionNotes = data.resolutionNotes;
            }

            const updated = await tx.supportTicket.update({
                where: { id },
                data: updatePayload,
            });

            await tx.supportTicketHistory.create({
                data: {
                    ticketId: id,
                    actorId: actor.id,
                    action: 'STATUS_CHANGE',
                    fromStatus: ticket.status,
                    toStatus: newStatus,
                    note: data.note || data.resolutionNotes || `Status changed to ${newStatus}`,
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SUPPORT_TICKET',
                entityId: id,
                entityLabel: ticket.ticketNumber,
                action: 'status_updated',
                after: { fromStatus: ticket.status, toStatus: newStatus },
            });

            return tx.supportTicket.findUnique({
                where: { id },
                include: TICKET_INCLUDE,
            });
        }, { timeout: 25000, maxWait: 15000 });
    }

    async escalateTicket(actor, id, data) {
        const ticket = await this.getById(actor, id);
        const { escalationReason, newAssignedRole, newAssigneeId, priority } = data;

        return this.prisma.$transaction(async (tx) => {
            const updatePayload = {
                status: 'ASSIGNED',
                assignedRole: newAssignedRole || 'MANAGEMENT',
            };
            if (newAssigneeId) updatePayload.assigneeId = newAssigneeId;
            if (priority) updatePayload.priority = priority;

            const updated = await tx.supportTicket.update({
                where: { id },
                data: updatePayload,
            });

            await tx.supportTicketHistory.create({
                data: {
                    ticketId: id,
                    actorId: actor.id,
                    action: 'ESCALATED',
                    fromStatus: ticket.status,
                    toStatus: 'ASSIGNED',
                    note: `Escalated to ${updatePayload.assignedRole}: ${escalationReason || 'Higher level attention required'}`,
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SUPPORT_TICKET',
                entityId: id,
                entityLabel: ticket.ticketNumber,
                action: 'escalated',
                after: { fromStatus: ticket.status, toStatus: 'ESCALATED', assignedRole: updatePayload.assignedRole },
            });

            return tx.supportTicket.findUnique({
                where: { id },
                include: TICKET_INCLUDE,
            });
        }, { timeout: 25000, maxWait: 15000 });
    }

    async getSummary(actor) {
        const where = {};
        if (actor.roleCode === 'AGENT' && !isTopTier(actor.roleCode)) {
            where.OR = [
                { createdById: actor.id },
                { assigneeId: actor.id },
            ];
        }

        const now = new Date();
        const [grouped, overdue] = await Promise.all([
            this.prisma.supportTicket.groupBy({
                by: ['status'],
                where,
                _count: { id: true },
            }),
            this.prisma.supportTicket.count({
                where: {
                    ...where,
                    dueDate: { lt: now },
                    status: { notIn: ['RESOLVED', 'CLOSED'] },
                },
            }),
        ]);

        let total = 0;
        let open = 0;
        let inProgress = 0;
        let resolved = 0;

        for (const g of grouped) {
            const count = g._count.id;
            total += count;
            if (g.status === 'OPEN' || g.status === 'ASSIGNED') open += count;
            else if (g.status === 'IN_PROGRESS') inProgress += count;
            else if (g.status === 'RESOLVED') resolved += count;
        }

        return { total, open, inProgress, resolved, overdue };
    }
};

SupportTicketsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService, AuditService])
], SupportTicketsService);

export { SupportTicketsService };
