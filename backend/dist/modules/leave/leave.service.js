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
exports.LeaveService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const pagination_1 = require("../../common/utils/pagination");
function parseDateOnly(dateStr) {
    const parts = dateStr.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}
let LeaveService = class LeaveService {
    prisma;
    audit;
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
            throw api_error_1.ApiError.conflict('LEAVE_TYPE_EXISTS', 'Leave type code already exists');
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
        if (actor.roleCode === 'FOUNDER') {
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
                    if (!target || !(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view leave balances for roles strictly below your rank (PRD §5.1.2)');
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
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own leave balance (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        conditions.push({ employee: { role: { code: { not: 'FOUNDER' } } } });
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
            employeeId: actor.id,
        });
    }
    async applyMy(actor, dto) {
        if (actor.roleCode === 'FOUNDER') {
            throw api_error_1.ApiError.badRequest('FOUNDER_LEAVE_NOT_APPLICABLE', 'Founder / CEO is the business owner and does not apply for leave');
        }
        return this.apply(actor, { ...dto, employeeId: actor.id });
    }
    async getApplications(actor, pagination, filters) {
        const conditions = [];
        if (actor.roleCode === 'FOUNDER') {
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
                    if (!target || !(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view leave applications for roles strictly below your rank (PRD §5.1.2)');
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
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own leave applications (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.leaveTypeId)
            conditions.push({ leaveTypeId: filters.leaveTypeId });
        conditions.push({ employee: { role: { code: { not: 'FOUNDER' } } } });
        if (filters.year) {
            const y = parseInt(filters.year, 10);
            const start = new Date(Date.UTC(y, 0, 1));
            const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            conditions.push({ startDate: { gte: start, lte: end } });
        }
        const where = conditions.length > 0 ? { AND: conditions } : {};
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
        return (0, pagination_1.toPage)(items, total, pagination);
    }
    async apply(actor, dto) {
        const isSelf = !dto.employeeId || dto.employeeId === actor.id;
        const targetEmployeeId = dto.employeeId ?? actor.id;
        if (actor.roleCode === 'STAFF' && !isSelf) {
            throw api_error_1.ApiError.forbidden('LEAVE_SELF_ONLY', 'Staff may only apply for their own leave');
        }
        const [employee, leaveType] = await Promise.all([
            this.prisma.employee.findUnique({ where: { id: targetEmployeeId }, include: { role: true } }),
            this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } }),
        ]);
        if (!employee)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (!leaveType)
            throw api_error_1.ApiError.notFound('LEAVE_TYPE_NOT_FOUND', 'Leave type not found');
        if (employee.role.code === 'FOUNDER' || actor.roleCode === 'FOUNDER') {
            throw api_error_1.ApiError.badRequest('FOUNDER_LEAVE_NOT_APPLICABLE', 'Founder / CEO is the business owner and does not apply for leave');
        }
        if (!isSelf) {
            if (!(0, shared_1.outranks)(actor.roleCode, employee.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only apply leave for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const startDate = parseDateOnly(dto.startDate);
        const endDate = parseDateOnly(dto.endDate);
        if (startDate > endDate) {
            throw api_error_1.ApiError.badRequest('INVALID_DATE_RANGE', 'Start date must be before or equal to end date');
        }
        const overlapping = await this.prisma.leaveApplication.findFirst({
            where: {
                employeeId: targetEmployeeId,
                status: { in: [shared_1.LeaveStatus.PENDING, shared_1.LeaveStatus.APPROVED] },
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
        });
        if (overlapping) {
            throw api_error_1.ApiError.badRequest('OVERLAPPING_LEAVE', 'An overlapping leave application already exists for this date range');
        }
        const year = startDate.getFullYear();
        const balance = await this.prisma.leaveBalance.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: targetEmployeeId,
                    leaveTypeId: dto.leaveTypeId,
                    year,
                },
            },
        });
        if (leaveType.isPaid) {
            if (!balance || Number(balance.balance) < dto.daysCount) {
                throw api_error_1.ApiError.badRequest('INSUFFICIENT_LEAVE_BALANCE', `Insufficient leave balance. Remaining: ${balance ? balance.balance : 0}, requested: ${dto.daysCount}`);
            }
        }
        const application = await this.prisma.$transaction(async (tx) => {
            const app = await tx.leaveApplication.create({
                data: {
                    employeeId: targetEmployeeId,
                    leaveTypeId: dto.leaveTypeId,
                    startDate,
                    endDate,
                    daysCount: dto.daysCount,
                    reason: dto.reason,
                    status: shared_1.LeaveStatus.PENDING,
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
                    toStatus: shared_1.LeaveStatus.PENDING,
                    reason: dto.reason,
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: app.id,
                entityLabel: `${employee.fullName} (${leaveType.name}: ${dto.daysCount} days)`,
                action: shared_1.AuditAction.LEAVE_APPLIED,
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
            throw api_error_1.ApiError.notFound('LEAVE_NOT_FOUND', 'Leave application not found');
        if (existing.status !== shared_1.LeaveStatus.PENDING) {
            throw api_error_1.ApiError.conflict('LEAVE_ALREADY_DECIDED', `Leave application has already been ${existing.status.toLowerCase()}`);
        }
        if (actor.id === existing.employeeId) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot approve your own leave');
        }
        if (actor.roleCode !== 'FOUNDER') {
            if (!(0, shared_1.outranks)(actor.roleCode, existing.employee.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only approve leaves for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.leaveApplication.update({
                where: { id },
                data: {
                    status: shared_1.LeaveStatus.APPROVED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: null,
                },
            });
            const year = existing.startDate.getFullYear();
            if (existing.leaveType.isPaid) {
                await tx.leaveBalance.updateMany({
                    where: {
                        employeeId: existing.employeeId,
                        leaveTypeId: existing.leaveTypeId,
                        year,
                    },
                    data: {
                        used: { increment: existing.daysCount },
                        balance: { decrement: existing.daysCount },
                    },
                });
            }
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
                        status: shared_1.AttendanceStatus.LEAVE,
                        source: shared_1.AttendanceSource.MANUAL,
                        approvalStatus: shared_1.ApprovalStatus.APPROVED,
                        approverId: actor.id,
                        approvedAt: new Date(),
                        notes: `Leave: ${existing.leaveType.name}`,
                    },
                    update: {
                        status: shared_1.AttendanceStatus.LEAVE,
                        approvalStatus: shared_1.ApprovalStatus.APPROVED,
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
                    fromStatus: shared_1.LeaveStatus.PENDING,
                    toStatus: shared_1.LeaveStatus.APPROVED,
                    reason: 'Approved by management',
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: shared_1.NotificationType.LEAVE_STATUS,
                    title: 'Leave Approved',
                    message: `Your leave application for ${existing.startDate.toISOString().slice(0, 10)} to ${existing.endDate.toISOString().slice(0, 10)} has been approved.`,
                    data: { leaveApplicationId: id, status: 'APPROVED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `Leave Approved: ${existing.employee.fullName}`,
                action: shared_1.AuditAction.LEAVE_APPROVED,
                before: existing,
                after: updated,
            });
            return updated;
        });
        return result;
    }
    async reject(actor, id, dto) {
        if (!dto.reason || dto.reason.trim().length < 5) {
            throw api_error_1.ApiError.badRequest('REASON_REQUIRED', 'Rejection reason is required (minimum 5 characters)');
        }
        const existing = await this.prisma.leaveApplication.findUnique({
            where: { id },
            include: { leaveType: true, employee: { include: { role: true } } },
        });
        if (!existing)
            throw api_error_1.ApiError.notFound('LEAVE_NOT_FOUND', 'Leave application not found');
        if (existing.status !== shared_1.LeaveStatus.PENDING) {
            throw api_error_1.ApiError.conflict('LEAVE_ALREADY_DECIDED', `Leave application has already been ${existing.status.toLowerCase()}`);
        }
        if (actor.id === existing.employeeId) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot reject your own leave');
        }
        if (actor.roleCode !== 'FOUNDER') {
            if (!(0, shared_1.outranks)(actor.roleCode, existing.employee.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only reject leaves for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.leaveApplication.update({
                where: { id },
                data: {
                    status: shared_1.LeaveStatus.REJECTED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: dto.reason,
                },
            });
            await tx.leaveApprovalHistory.create({
                data: {
                    leaveApplicationId: id,
                    actorId: actor.id,
                    action: 'REJECTED',
                    fromStatus: shared_1.LeaveStatus.PENDING,
                    toStatus: shared_1.LeaveStatus.REJECTED,
                    reason: dto.reason,
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: shared_1.NotificationType.LEAVE_STATUS,
                    title: 'Leave Rejected',
                    message: `Your leave application for ${existing.startDate.toISOString().slice(0, 10)} to ${existing.endDate.toISOString().slice(0, 10)} was rejected: ${dto.reason}`,
                    data: { leaveApplicationId: id, status: 'REJECTED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `Leave Rejected: ${existing.employee.fullName}`,
                action: shared_1.AuditAction.LEAVE_REJECTED,
                before: existing,
                after: updated,
            });
            return updated;
        });
        return result;
    }
};
exports.LeaveService = LeaveService;
exports.LeaveService = LeaveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], LeaveService);
//# sourceMappingURL=leave.service.js.map