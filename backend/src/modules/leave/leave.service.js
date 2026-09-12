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
import { ApprovalStatus, AttendanceSource, AttendanceStatus, AuditAction, AuditEntityType, isTopTier, LeaveStatus, NotificationType, outranks, } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
function parseDateOnly(value) {
    const datePart = typeof value === 'string' ? value.split('T')[0] : '';
    const date = new Date(`${datePart}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) {
        throw ApiError.badRequest('INVALID_DATE', 'A valid calendar date is required');
    }
    return date;
}
function leaveDaysByYear(startDate, endDate, daysCount) {
    if (daysCount === 0.5) return [{ year: startDate.getUTCFullYear(), days: 0.5 }];
    const years = [];
    for (let year = startDate.getUTCFullYear(); year <= endDate.getUTCFullYear(); year++) {
        const start = Math.max(startDate.getTime(), Date.UTC(year, 0, 1));
        const end = Math.min(endDate.getTime(), Date.UTC(year, 11, 31));
        years.push({ year, days: (end - start) / 86_400_000 + 1 });
    }
    return years;
}
let LeaveService = class LeaveService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getTypes() {
        return this.prisma.leaveType.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    async createType(dto) {
        const existing = await this.prisma.leaveType.findUnique({
            where: { code: dto.code },
        });
        if (existing)
            throw ApiError.conflict('LEAVE_TYPE_EXISTS', 'Leave type code already exists');
        return this.prisma.leaveType.create({
            data: {
                code: dto.code,
                name: dto.name,
                description: dto.description,
                quotaDays: dto.quotaDays,
                isPaid: dto.isPaid ?? true,
                allowCarryForward: dto.allowCarryForward ?? false,
            },
        });
    }
    async getBalances(actor, query) {
        const conditions = [];
        const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
        conditions.push({ year });
        if (isTopTier(actor.roleCode)) {
            if (query.employeeId)
                conditions.push({ employeeId: query.employeeId });
        }
        else if (actor.roleCode === 'MANAGER') {
            if (query.employeeId) {
                if (query.employeeId !== actor.id) {
                    const target = await this.prisma.employee.findUnique({
                        where: { id: query.employeeId },
                        include: { role: true },
                    });
                    if (!target || !outranks(actor.roleCode, target.role.code)) {
                        throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view leave balances for roles strictly below your rank (PRD §5.1.2)');
                    }
                }
                conditions.push({ employeeId: query.employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { role: { code: { in: ['AGENT', 'STAFF', 'DELIVERY'] } } } },
                    ],
                });
            }
        }
        else {
            if (query.employeeId && query.employeeId !== actor.id) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own leave balance (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        // Founder / CEO (and the equally business-owner-tier Super Admin) are not tracked for leave balances
        conditions.push({ employee: { role: { code: { notIn: ['FOUNDER', 'SUPER_ADMIN'] } } } });
        return this.prisma.leaveBalance.findMany({
            where: { AND: conditions },
            include: {
                leaveType: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        fullName: true,
                        email: true,
                        department: true,
                    },
                },
            },
            orderBy: [{ year: 'desc' }, { leaveType: { name: 'asc' } }],
        });
    }
    async getBalancesMy(actor, query) {
        return this.getBalances(actor, { year: query.year, employeeId: actor.id });
    }
    async getApplicationsMy(actor, pagination, filters) {
        return this.getApplications(actor, pagination, {
            ...filters,
            employeeId: actor.id, // HARD-ENFORCED SERVER-SIDE
        });
    }
    async applyMy(actor, dto) {
        if (isTopTier(actor.roleCode)) {
            throw ApiError.badRequest('FOUNDER_LEAVE_NOT_APPLICABLE', 'Founder / CEO is the business owner and does not apply for leave');
        }
        return this.apply(actor, { ...dto, employeeId: actor.id });
    }
    async getApplications(actor, pagination, filters) {
        const conditions = [];
        if (isTopTier(actor.roleCode)) {
            if (filters.employeeId)
                conditions.push({ employeeId: filters.employeeId });
        }
        else if (actor.roleCode === 'MANAGER') {
            if (filters.employeeId) {
                if (filters.employeeId !== actor.id) {
                    const target = await this.prisma.employee.findUnique({
                        where: { id: filters.employeeId },
                        include: { role: true },
                    });
                    if (!target || !outranks(actor.roleCode, target.role.code)) {
                        throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view leave applications for roles strictly below your rank (PRD §5.1.2)');
                    }
                }
                conditions.push({ employeeId: filters.employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { role: { code: { in: ['AGENT', 'STAFF', 'DELIVERY'] } } } },
                    ],
                });
            }
        }
        else {
            if (filters.employeeId && filters.employeeId !== actor.id) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own leave applications (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.leaveTypeId)
            conditions.push({ leaveTypeId: filters.leaveTypeId });
        // Founder / CEO (and Super Admin) never has leave applications
        conditions.push({ employee: { role: { code: { notIn: ['FOUNDER', 'SUPER_ADMIN'] } } } });
        if (filters.year) {
            const y = parseInt(filters.year, 10);
            const start = new Date(Date.UTC(y, 0, 1));
            const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            conditions.push({ startDate: { gte: start, lte: end } });
        }
        const where = conditions.length > 0 ? { AND: conditions } : {};
        // Check for CSV format export
        if (filters.format === 'csv') {
            const allRows = await this.prisma.leaveApplication.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    leaveType: true,
                    employee: {
                        select: { id: true, employeeCode: true, fullName: true, email: true },
                    },
                },
            });
            const header = 'ApplicationId,EmployeeCode,EmployeeName,LeaveType,StartDate,EndDate,Days,Status,Reason,CreatedAt\n';
            const rows = allRows.map((r) => {
                const cleanReason = (r.reason || '').replace(/[,\n\r"]/g, ' ');
                return `"${r.id}","${r.employee.employeeCode ?? ''}","${r.employee.fullName}","${r.leaveType.name}","${r.startDate.toISOString().slice(0, 10)}","${r.endDate.toISOString().slice(0, 10)}",${r.daysCount},"${r.status}","${cleanReason}","${r.createdAt.toISOString()}"`;
            });
            return header + rows.join('\n');
        }
        const [total, items] = await Promise.all([
            this.prisma.leaveApplication.count({ where }),
            this.prisma.leaveApplication.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (pagination.page - 1) * pagination.pageSize,
                take: pagination.pageSize,
                include: {
                    leaveType: true,
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            fullName: true,
                            email: true,
                            department: true,
                            designation: true,
                        },
                    },
                    approvalHistory: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            }),
        ]);
        return toPage(items, total, pagination);
    }
    async apply(actor, dto) {
        const isSelf = !dto.employeeId || dto.employeeId === actor.id;
        const targetEmployeeId = dto.employeeId ?? actor.id;
        if (actor.roleCode === 'STAFF' && !isSelf) {
            throw ApiError.forbidden('LEAVE_SELF_ONLY', 'Staff may only apply for their own leave');
        }
        const [employee, leaveType] = await Promise.all([
            this.prisma.employee.findUnique({ where: { id: targetEmployeeId }, include: { role: true } }),
            this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } }),
        ]);
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (!leaveType)
            throw ApiError.notFound('LEAVE_TYPE_NOT_FOUND', 'Leave type not found');
        if (isTopTier(employee.role.code) || isTopTier(actor.roleCode)) {
            throw ApiError.badRequest('FOUNDER_LEAVE_NOT_APPLICABLE', 'Founder / CEO is the business owner and does not apply for leave');
        }
        if (!isSelf) {
            if (!outranks(actor.roleCode, employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only apply leave for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const startDate = parseDateOnly(dto.startDate);
        const endDate = parseDateOnly(dto.endDate);
        if (startDate > endDate) {
            throw ApiError.badRequest('INVALID_DATE_RANGE', 'Start date must be before or equal to end date');
        }
        const calendarDays = (endDate.getTime() - startDate.getTime()) / 86_400_000 + 1;
        const daysCount = calendarDays === 1 && dto.daysCount === 0.5 ? 0.5 : calendarDays;
        if (dto.daysCount !== daysCount) {
            throw ApiError.badRequest('INVALID_LEAVE_DURATION', 'Days must match the inclusive calendar date range, or be 0.5 for a single date');
        }
        // Check for overlapping applications
        const overlapping = await this.prisma.leaveApplication.findFirst({
            where: {
                employeeId: targetEmployeeId,
                status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
        });
        if (overlapping) {
            throw ApiError.badRequest('OVERLAPPING_LEAVE', 'An overlapping leave application already exists for this date range');
        }
        if (leaveType.isPaid) {
            for (const { year, days } of leaveDaysByYear(startDate, endDate, daysCount)) {
                const balance = await this.prisma.leaveBalance.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: targetEmployeeId,
                            leaveTypeId: dto.leaveTypeId,
                            year,
                        },
                    },
                });
                if (!balance || Number(balance.balance) < days) {
                    throw ApiError.badRequest('INSUFFICIENT_LEAVE_BALANCE', `Insufficient leave balance for ${year}`);
                }
            }
        }
        const application = await this.prisma.$transaction(async (tx) => {
            const app = await tx.leaveApplication.create({
                data: {
                    employeeId: targetEmployeeId,
                    leaveTypeId: dto.leaveTypeId,
                    startDate,
                    endDate,
                    daysCount,
                    reason: dto.reason,
                    status: LeaveStatus.PENDING,
                },
                include: {
                    leaveType: true,
                    employee: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            });
            await tx.leaveApprovalHistory.create({
                data: {
                    leaveApplicationId: app.id,
                    actorId: actor.id,
                    action: 'APPLIED',
                    fromStatus: null,
                    toStatus: LeaveStatus.PENDING,
                    reason: dto.reason,
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: app.id,
                entityLabel: `${employee.fullName} (${leaveType.name}: ${dto.daysCount} days)`,
                action: AuditAction.LEAVE_APPLIED,
                after: app,
            });
            return app;
        });
        return application;
    }
    async approve(actor, id) {
        const existing = await this.prisma.leaveApplication.findUnique({
            where: { id },
            include: { leaveType: true, employee: { include: { role: true } } },
        });
        if (!existing)
            throw ApiError.notFound('LEAVE_NOT_FOUND', 'Leave application not found');
        if (existing.status !== LeaveStatus.PENDING) {
            throw ApiError.conflict('LEAVE_ALREADY_DECIDED', `Leave application has already been ${existing.status.toLowerCase()}`);
        }
        if (actor.id === existing.employeeId) {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot approve your own leave');
        }
        if (!isTopTier(actor.roleCode)) {
            if (!outranks(actor.roleCode, existing.employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only approve leaves for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const decision = await tx.leaveApplication.updateMany({
                where: { id, status: LeaveStatus.PENDING },
                data: {
                    status: LeaveStatus.APPROVED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: null,
                },
            });
            if (decision.count !== 1) {
                throw ApiError.conflict('LEAVE_ALREADY_DECIDED', 'Leave application has already been decided');
            }
            const updated = await tx.leaveApplication.findUnique({ where: { id } });
            // Deduct each calendar year's balance only if sufficient days remain.
            const days = (existing.endDate.getTime() - existing.startDate.getTime()) / 86_400_000 + 1;
            const halfDay = days === 1 && Number(existing.daysCount) === 0.5;
            if (days <= 0 || (!halfDay && Number(existing.daysCount) !== days)) {
                throw ApiError.badRequest('INVALID_LEAVE_DURATION', 'Leave duration must match the calendar date range');
            }
            if (existing.leaveType.isPaid) {
                for (const { year, days } of leaveDaysByYear(existing.startDate, existing.endDate, Number(existing.daysCount))) {
                    const deducted = await tx.leaveBalance.updateMany({
                        where: { employeeId: existing.employeeId, leaveTypeId: existing.leaveTypeId, year, balance: { gte: days } },
                        data: { used: { increment: days }, balance: { decrement: days } },
                    });
                    if (deducted.count !== 1) {
                        throw ApiError.badRequest('INSUFFICIENT_LEAVE_BALANCE', `Insufficient leave balance for ${year}`);
                    }
                }
            }
            // Generate Attendance records for leave duration
            const curr = new Date(existing.startDate);
            while (curr <= existing.endDate) {
                const dateCopy = new Date(curr);
                await tx.attendanceRecord.upsert({
                    where: {
                        employeeId_date: {
                            employeeId: existing.employeeId,
                            date: dateCopy,
                        },
                    },
                    create: {
                        employeeId: existing.employeeId,
                        date: dateCopy,
                        status: AttendanceStatus.LEAVE,
                        source: AttendanceSource.MANUAL,
                        approvalStatus: ApprovalStatus.APPROVED,
                        approverId: actor.id,
                        approvedAt: new Date(),
                        notes: `Leave: ${existing.leaveType.name}`,
                    },
                    update: {
                        status: AttendanceStatus.LEAVE,
                        approvalStatus: ApprovalStatus.APPROVED,
                        approverId: actor.id,
                        approvedAt: new Date(),
                        notes: `Leave: ${existing.leaveType.name}`,
                    },
                });
                curr.setUTCDate(curr.getUTCDate() + 1);
            }
            await tx.leaveApprovalHistory.create({
                data: {
                    leaveApplicationId: id,
                    actorId: actor.id,
                    action: 'APPROVED',
                    fromStatus: LeaveStatus.PENDING,
                    toStatus: LeaveStatus.APPROVED,
                    reason: 'Approved by management',
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: NotificationType.LEAVE_STATUS,
                    title: 'Leave Approved',
                    message: `Your leave application for ${existing.startDate.toISOString().slice(0, 10)} to ${existing.endDate.toISOString().slice(0, 10)} has been approved.`,
                    data: { leaveApplicationId: id, status: 'APPROVED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `Leave Approved: ${existing.employee.fullName}`,
                action: AuditAction.LEAVE_APPROVED,
                before: existing,
                after: updated,
            });
            return updated;
        });
        return result;
    }
    async reject(actor, id, dto) {
        if (!dto.reason || dto.reason.trim().length < 5) {
            throw ApiError.badRequest('REASON_REQUIRED', 'Rejection reason is required (minimum 5 characters)');
        }
        const existing = await this.prisma.leaveApplication.findUnique({
            where: { id },
            include: { leaveType: true, employee: { include: { role: true } } },
        });
        if (!existing)
            throw ApiError.notFound('LEAVE_NOT_FOUND', 'Leave application not found');
        if (existing.status !== LeaveStatus.PENDING) {
            throw ApiError.conflict('LEAVE_ALREADY_DECIDED', `Leave application has already been ${existing.status.toLowerCase()}`);
        }
        if (actor.id === existing.employeeId) {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot reject your own leave');
        }
        if (!isTopTier(actor.roleCode)) {
            if (!outranks(actor.roleCode, existing.employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only reject leaves for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const decision = await tx.leaveApplication.updateMany({
                where: { id, status: LeaveStatus.PENDING },
                data: {
                    status: LeaveStatus.REJECTED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: dto.reason,
                },
            });
            if (decision.count !== 1) {
                throw ApiError.conflict('LEAVE_ALREADY_DECIDED', 'Leave application has already been decided');
            }
            const updated = await tx.leaveApplication.findUnique({ where: { id } });
            await tx.leaveApprovalHistory.create({
                data: {
                    leaveApplicationId: id,
                    actorId: actor.id,
                    action: 'REJECTED',
                    fromStatus: LeaveStatus.PENDING,
                    toStatus: LeaveStatus.REJECTED,
                    reason: dto.reason,
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: NotificationType.LEAVE_STATUS,
                    title: 'Leave Rejected',
                    message: `Your leave application for ${existing.startDate.toISOString().slice(0, 10)} to ${existing.endDate.toISOString().slice(0, 10)} was rejected: ${dto.reason}`,
                    data: { leaveApplicationId: id, status: 'REJECTED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `Leave Rejected: ${existing.employee.fullName}`,
                action: AuditAction.LEAVE_REJECTED,
                before: existing,
                after: updated,
            });
            return updated;
        });
        return result;
    }
};
LeaveService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], LeaveService);
export { LeaveService };
