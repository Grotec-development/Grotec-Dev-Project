var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, EmployeeRequestStatus, EmployeeRequestType, NotificationType, ROLE_RANK, isTopTier, outranks, toTechnicalRole, } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
import { resolveTenantId } from '../../common/utils/tenant-scope';
const TYPE_LABELS = {
    [EmployeeRequestType.MANAGER_NOTE]: 'Note to manager',
    [EmployeeRequestType.HR_INQUIRY]: 'HR inquiry',
    [EmployeeRequestType.OFFICE_RESOURCE]: 'Office resource request',
    [EmployeeRequestType.ISSUE_REPORT]: 'Issue report',
};
const OPEN_STATUSES = [EmployeeRequestStatus.OPEN, EmployeeRequestStatus.IN_PROGRESS];
const REQUEST_INCLUDE = {
    requester: { select: { id: true, fullName: true, employeeCode: true, role: { select: { code: true } } } },
    assignee: { select: { id: true, fullName: true } },
    history: { orderBy: { createdAt: 'asc' } },
};
/**
 * Action Center requests that are not leave or shift permissions. A manager
 * note goes to the requester's reporting manager; everything else (and a note
 * from someone without a manager) sits in the shared queue of managers who
 * outrank the requester.
 */
let RequestsService = class RequestsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async create(actor, dto) {
        const requester = await this.prisma.employee.findFirst({
            where: { id: actor.id, deletedAt: null },
            select: { id: true, fullName: true, reportingManagerId: true, role: { select: { code: true } } },
        });
        if (!requester)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        const message = dto.message.trim();
        if (!message)
            throw ApiError.badRequest('MESSAGE_REQUIRED', 'Please describe your request');
        let assigneeId = null;
        if (dto.type === EmployeeRequestType.MANAGER_NOTE && requester.reportingManagerId) {
            const manager = await this.prisma.employee.findFirst({
                where: { id: requester.reportingManagerId, status: 'ACTIVE', deletedAt: null },
                select: { id: true },
            });
            assigneeId = manager?.id ?? null;
        }
        const tenantId = await resolveTenantId(this.prisma, actor);
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.employeeRequest.create({
                data: { tenantId, requesterId: requester.id, assigneeId, type: dto.type, message },
            });
            await tx.employeeRequestHistory.create({
                data: { requestId: request.id, actorId: actor.id, action: 'SUBMITTED', fromStatus: null, toStatus: request.status, note: null },
            });
            const recipientIds = assigneeId ? [assigneeId] : await this.handlerIdsFor(tx, requester);
            if (recipientIds.length > 0) {
                await tx.appNotification.createMany({
                    data: recipientIds.map((recipientId) => ({
                        recipientId,
                        type: NotificationType.EMPLOYEE_REQUEST_SUBMITTED,
                        title: `New ${TYPE_LABELS[dto.type].toLowerCase()}`,
                        message: `${requester.fullName}: ${message.length > 140 ? `${message.slice(0, 137)}...` : message}`,
                        data: { requestId: request.id, type: dto.type },
                    })),
                });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE_REQUEST,
                entityId: request.id,
                entityLabel: `${TYPE_LABELS[dto.type]} from ${requester.fullName}`,
                action: AuditAction.REQUEST_SUBMITTED,
                after: { type: dto.type, assigneeId },
            });
            return tx.employeeRequest.findUnique({ where: { id: request.id }, include: REQUEST_INCLUDE });
        });
    }
    async listMine(actor, pagination, filters = {}) {
        const where = { requesterId: actor.id, ...(filters.status ? { status: this.statusFilter(filters.status) } : {}) };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employeeRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take }),
            this.prisma.employeeRequest.count({ where }),
        ]);
        return toPage(items, total, pagination);
    }
    async inbox(actor, pagination, filters = {}) {
        const conditions = [this.inboxScope(actor)];
        if (filters.status)
            conditions.push({ status: this.statusFilter(filters.status) });
        if (filters.type) {
            if (!Object.values(EmployeeRequestType).includes(filters.type))
                throw ApiError.badRequest('INVALID_TYPE', `type must be one of ${Object.values(EmployeeRequestType).join(', ')}`);
            conditions.push({ type: filters.type });
        }
        const where = { AND: conditions };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employeeRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take }),
            this.prisma.employeeRequest.count({ where }),
        ]);
        return toPage(items, total, pagination);
    }
    async updateStatus(actor, id, dto) {
        const existing = await this.prisma.employeeRequest.findFirst({
            where: { AND: [{ id }, this.inboxScope(actor)] },
            include: { requester: { select: { id: true, fullName: true } } },
        });
        if (!existing)
            throw ApiError.notFound('REQUEST_NOT_FOUND', 'Request not found');
        if (existing.requesterId === actor.id)
            throw ApiError.forbidden('OWN_REQUEST', 'You cannot action your own request');
        if (!OPEN_STATUSES.includes(existing.status))
            throw ApiError.conflict('REQUEST_CLOSED', `This request is already ${existing.status.toLowerCase()}`);
        if (existing.status === dto.status)
            throw ApiError.conflict('REQUEST_UNCHANGED', `This request is already ${dto.status.toLowerCase().replace('_', ' ')}`);
        const note = dto.note?.trim() || null;
        if (dto.status === EmployeeRequestStatus.REJECTED && !note)
            throw ApiError.badRequest('REASON_REQUIRED', 'A reason is required to reject a request');
        const closing = dto.status !== EmployeeRequestStatus.IN_PROGRESS;
        return this.prisma.$transaction(async (tx) => {
            // Guarded on the status we read, so two handlers cannot both decide it
            const claim = await tx.employeeRequest.updateMany({
                where: { id, status: existing.status },
                data: {
                    status: dto.status,
                    ...(closing ? { resolvedAt: new Date(), resolutionNote: note } : {}),
                },
            });
            if (claim.count === 0)
                throw ApiError.conflict('REQUEST_CHANGED', 'This request was updated by someone else; refresh and try again');
            await tx.employeeRequestHistory.create({
                data: { requestId: id, actorId: actor.id, action: dto.status, fromStatus: existing.status, toStatus: dto.status, note },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.requesterId,
                    type: NotificationType.EMPLOYEE_REQUEST_UPDATED,
                    title: `${TYPE_LABELS[existing.type]} ${dto.status.toLowerCase().replace('_', ' ')}`,
                    message: note ?? `${actor.fullName ?? 'Your manager'} marked your request as ${dto.status.toLowerCase().replace('_', ' ')}.`,
                    data: { requestId: id, status: dto.status },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE_REQUEST,
                entityId: id,
                entityLabel: `${TYPE_LABELS[existing.type]} from ${existing.requester.fullName}`,
                action: AuditAction.REQUEST_STATUS_CHANGED,
                before: { status: existing.status },
                after: { status: dto.status, note },
            });
            return tx.employeeRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
        });
    }
    /** Requests a handler may see: top tier sees all; others see ones assigned to them or queued from lower ranks. */
    inboxScope(actor) {
        const tenantScope = actor.tenantId ? [{ tenantId: actor.tenantId }] : [];
        if (isTopTier(toTechnicalRole(actor.roleCode)))
            return { AND: tenantScope };
        const lowerRoles = Object.keys(ROLE_RANK).filter((code) => outranks(actor.roleCode, code));
        return {
            AND: [
                ...tenantScope,
                {
                    OR: [
                        { assigneeId: actor.id },
                        { assigneeId: null, requester: { role: { code: { in: lowerRoles } } } },
                    ],
                },
            ],
        };
    }
    /** Active employees who outrank the requester — the shared queue's handlers. */
    async handlerIdsFor(db, requester) {
        const candidates = await db.employee.findMany({
            where: { status: 'ACTIVE', deletedAt: null, id: { not: requester.id } },
            select: { id: true, role: { select: { code: true } } },
        });
        return candidates
            .filter((c) => ['SUPER_ADMIN', 'FOUNDER', 'MANAGER'].includes(toTechnicalRole(c.role.code)))
            .filter((c) => outranks(c.role.code, requester.role.code))
            .map((c) => c.id);
    }
    statusFilter(raw) {
        if (raw === 'OPEN_ALL')
            return { in: OPEN_STATUSES };
        if (!Object.values(EmployeeRequestStatus).includes(raw))
            throw ApiError.badRequest('INVALID_STATUS', `status must be one of ${Object.values(EmployeeRequestStatus).join(', ')}, OPEN_ALL`);
        return raw;
    }
};
RequestsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], RequestsService);
export { RequestsService };
