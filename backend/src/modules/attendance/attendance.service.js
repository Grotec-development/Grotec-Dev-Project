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
import { ApprovalStatus, AttendanceSource, AttendanceStatus, AuditAction, AuditEntityType, NotificationType, outranks, PERMISSIONS, } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
function parseDateOnly(dateStr) {
    const parts = dateStr.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}
let AttendanceService = class AttendanceService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(actor, pagination, filters) {
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
                    if (!target || !outranks(actor.roleCode, target.role.code)) {
                        throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view attendance for roles strictly below your rank (PRD §5.1.2)');
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
        else if (actor.roleCode === 'STAFF') {
            if (filters.employeeId && filters.employeeId !== actor.id) {
                // Staff can only view self or assigned employees
                const assigned = await this.prisma.employeeAssignment.findUnique({
                    where: {
                        staffEmployeeId_assignedEmployeeId: {
                            staffEmployeeId: actor.id,
                            assignedEmployeeId: filters.employeeId,
                        },
                    },
                });
                if (!assigned) {
                    throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view attendance for yourself or assigned employees');
                }
                conditions.push({ employeeId: filters.employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { assignedStaffs: { some: { staffEmployeeId: actor.id } } } },
                    ],
                });
            }
        }
        else {
            if (filters.employeeId && filters.employeeId !== actor.id) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own attendance records (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        // Founder / CEO is not tracked for attendance
        conditions.push({ employee: { role: { code: { not: 'FOUNDER' } } } });
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.approvalStatus)
            conditions.push({ approvalStatus: filters.approvalStatus });
        if (filters.source)
            conditions.push({ source: filters.source });
        if (filters.month) {
            const [yearStr, monthStr] = filters.month.split('-');
            const y = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10);
            const startDate = new Date(Date.UTC(y, m - 1, 1));
            const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            conditions.push({ date: { gte: startDate, lte: endDate } });
        }
        else if (filters.from || filters.to) {
            const dateCond = {};
            if (filters.from)
                dateCond.gte = parseDateOnly(filters.from);
            if (filters.to)
                dateCond.lte = parseDateOnly(filters.to);
            conditions.push({ date: dateCond });
        }
        const where = conditions.length > 0 ? { AND: conditions } : {};
        const [total, items] = await Promise.all([
            this.prisma.attendanceRecord.count({ where }),
            this.prisma.attendanceRecord.findMany({
                where,
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                skip: (pagination.page - 1) * pagination.pageSize,
                take: pagination.pageSize,
                include: {
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
                    punches: {
                        orderBy: { punchTime: 'asc' },
                    },
                },
            }),
        ]);
        return toPage(items, total, pagination);
    }
    async listMy(actor, pagination, filters) {
        const conditions = [
            { employeeId: actor.id }, // HARD-ENFORCED SERVER-SIDE (Zero override)
        ];
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.source)
            conditions.push({ source: filters.source });
        if (filters.month) {
            const [yearStr, monthStr] = filters.month.split('-');
            const y = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10);
            const startDate = new Date(Date.UTC(y, m - 1, 1));
            const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            conditions.push({ date: { gte: startDate, lte: endDate } });
        }
        else if (filters.from || filters.to) {
            const dateCond = {};
            if (filters.from)
                dateCond.gte = parseDateOnly(filters.from);
            if (filters.to)
                dateCond.lte = parseDateOnly(filters.to);
            conditions.push({ date: dateCond });
        }
        const where = { AND: conditions };
        const [total, items] = await Promise.all([
            this.prisma.attendanceRecord.count({ where }),
            this.prisma.attendanceRecord.findMany({
                where,
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                skip: (pagination.page - 1) * pagination.pageSize,
                take: pagination.pageSize,
                include: {
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
                    punches: {
                        orderBy: { punchTime: 'asc' },
                    },
                },
            }),
        ]);
        return toPage(items, total, pagination);
    }
    async getSummaryMy(actor, query) {
        return this.getSummary(actor, { month: query.month, employeeId: actor.id });
    }
    async markMy(actor, dto) {
        if (actor.roleCode === 'FOUNDER') {
            throw ApiError.badRequest('FOUNDER_ATTENDANCE_NOT_APPLICABLE', 'Founder / CEO is the business owner and is not tracked for attendance');
        }
        return this.mark(actor, { ...dto, employeeId: actor.id });
    }
    async getSummary(actor, query) {
        const conditions = [];
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
                    if (!target || !outranks(actor.roleCode, target.role.code)) {
                        throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view attendance summary for roles strictly below your rank (PRD §5.1.2)');
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
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own attendance summary (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        const [yearStr, monthStr] = query.month.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10);
        const startDate = new Date(Date.UTC(y, m - 1, 1));
        const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        conditions.push({ date: { gte: startDate, lte: endDate } });
        const records = await this.prisma.attendanceRecord.findMany({
            where: { AND: conditions },
        });
        const stats = {
            present: records.filter((r) => r.status === 'PRESENT').length,
            absent: records.filter((r) => r.status === 'ABSENT').length,
            late: records.filter((r) => r.status === 'LATE').length,
            halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
            weeklyOff: records.filter((r) => r.status === 'WEEKLY_OFF').length,
            holiday: records.filter((r) => r.status === 'HOLIDAY').length,
            leave: records.filter((r) => r.status === 'LEAVE').length,
            pendingApprovals: records.filter((r) => r.approvalStatus === 'PENDING').length,
            totalRecords: records.length,
        };
        return stats;
    }
    async mark(actor, dto) {
        const isSelf = !dto.employeeId || dto.employeeId === actor.id;
        const targetEmployeeId = dto.employeeId ?? actor.id;
        if (actor.roleCode === 'STAFF' && !isSelf) {
            throw ApiError.forbidden('ATTENDANCE_SELF_ONLY', 'Staff may only mark their own attendance');
        }
        const employee = await this.prisma.employee.findUnique({
            where: { id: targetEmployeeId },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (employee.role.code === 'FOUNDER' || actor.roleCode === 'FOUNDER') {
            throw ApiError.badRequest('FOUNDER_ATTENDANCE_NOT_APPLICABLE', 'Founder / CEO is the business owner and is not tracked for attendance');
        }
        if (!isSelf) {
            if (!outranks(actor.roleCode, employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only mark attendance for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const date = parseDateOnly(dto.date);
        const existing = await this.prisma.attendanceRecord.findUnique({
            where: {
                employeeId_date: {
                    employeeId: targetEmployeeId,
                    date,
                },
            },
        });
        if (existing) {
            throw ApiError.conflict('ATTENDANCE_ALREADY_EXISTS', 'Attendance record already exists for this date');
        }
        const canApprove = actor.permissions.includes(PERMISSIONS.attendanceApprove) && !isSelf;
        const initialApprovalStatus = canApprove
            ? ApprovalStatus.APPROVED
            : ApprovalStatus.PENDING;
        const punchInDate = dto.punchIn ? new Date(dto.punchIn) : null;
        const punchOutDate = dto.punchOut ? new Date(dto.punchOut) : null;
        const record = await this.prisma.$transaction(async (tx) => {
            const created = await tx.attendanceRecord.create({
                data: {
                    employeeId: targetEmployeeId,
                    date,
                    status: dto.status,
                    source: AttendanceSource.MANUAL,
                    punchIn: punchInDate,
                    punchOut: punchOutDate,
                    notes: dto.notes,
                    approvalStatus: initialApprovalStatus,
                    approverId: canApprove ? actor.id : null,
                    approvedAt: canApprove ? new Date() : null,
                    createdById: actor.id,
                },
            });
            await tx.attendanceApprovalHistory.create({
                data: {
                    attendanceRecordId: created.id,
                    actorId: actor.id,
                    action: 'CREATED_MANUAL',
                    fromStatus: null,
                    toStatus: initialApprovalStatus,
                    reason: dto.notes ?? 'Manual attendance marked',
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: created.id,
                entityLabel: `${employee.fullName} (${dto.date})`,
                action: AuditAction.ATTENDANCE_MARKED,
                after: created,
            });
            return created;
        });
        return record;
    }
    async bulkMark(actor, dto) {
        if (actor.roleCode === 'STAFF' || actor.roleCode === 'AGENT' || actor.roleCode === 'DELIVERY') {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Staff and agents cannot perform bulk attendance operations');
        }
        const canApprove = actor.permissions.includes(PERMISSIONS.attendanceApprove);
        const date = parseDateOnly(dto.date);
        if (actor.roleCode !== 'FOUNDER') {
            const empIds = dto.records.map((r) => r.employeeId);
            const employees = await this.prisma.employee.findMany({
                where: { id: { in: empIds } },
                include: { role: true },
            });
            for (const emp of employees) {
                if (!outranks(actor.roleCode, emp.role.code)) {
                    throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', `Cannot mark attendance for employee ${emp.fullName} at or above your rank (PRD §5.1.2)`);
                }
            }
        }
        const initialApprovalStatus = canApprove
            ? ApprovalStatus.APPROVED
            : ApprovalStatus.PENDING;
        let createdCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const results = [];
        for (const item of dto.records) {
            try {
                const existing = await this.prisma.attendanceRecord.findUnique({
                    where: { employeeId_date: { employeeId: item.employeeId, date } },
                });
                if (existing) {
                    skippedCount++;
                    results.push({ employeeId: item.employeeId, status: 'SKIPPED', error: 'Record already exists' });
                    continue;
                }
                const punchIn = item.punchIn ? new Date(item.punchIn) : null;
                const punchOut = item.punchOut ? new Date(item.punchOut) : null;
                await this.prisma.$transaction(async (tx) => {
                    const rec = await tx.attendanceRecord.create({
                        data: {
                            employeeId: item.employeeId,
                            date,
                            status: item.status,
                            source: AttendanceSource.MANUAL,
                            punchIn,
                            punchOut,
                            notes: item.notes,
                            approvalStatus: initialApprovalStatus,
                            approverId: canApprove ? actor.id : null,
                            approvedAt: canApprove ? new Date() : null,
                            createdById: actor.id,
                        },
                    });
                    await tx.attendanceApprovalHistory.create({
                        data: {
                            attendanceRecordId: rec.id,
                            actorId: actor.id,
                            action: 'BULK_MARK',
                            fromStatus: null,
                            toStatus: initialApprovalStatus,
                            reason: item.notes ?? 'Bulk mark entry',
                        },
                    });
                });
                createdCount++;
                results.push({ employeeId: item.employeeId, status: 'CREATED' });
            }
            catch (err) {
                failedCount++;
                results.push({ employeeId: item.employeeId, status: 'FAILED', error: err.message });
            }
        }
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: actor.id,
            entityLabel: `Bulk marked ${createdCount} attendance records for ${dto.date}`,
            action: AuditAction.ATTENDANCE_MARKED,
            after: { created: createdCount, skipped: skippedCount, failed: failedCount, date: dto.date },
        });
        return { created: createdCount, skipped: skippedCount, failed: failedCount, results };
    }
    async correct(actor, id, dto) {
        if (!dto.reason || dto.reason.trim().length < 10) {
            throw ApiError.badRequest('REASON_REQUIRED', 'Correction reason is required (minimum 10 characters)');
        }
        const existing = await this.prisma.attendanceRecord.findUnique({
            where: { id },
            include: { employee: { include: { role: true } } },
        });
        if (!existing)
            throw ApiError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found');
        if (actor.roleCode !== 'FOUNDER') {
            if (!outranks(actor.roleCode, existing.employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only correct attendance for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const resetToPending = existing.approvalStatus === ApprovalStatus.APPROVED;
        const newApprovalStatus = resetToPending ? ApprovalStatus.PENDING : existing.approvalStatus;
        const punchIn = dto.punchIn ? new Date(dto.punchIn) : existing.punchIn;
        const punchOut = dto.punchOut ? new Date(dto.punchOut) : existing.punchOut;
        const updated = await this.prisma.$transaction(async (tx) => {
            const rec = await tx.attendanceRecord.update({
                where: { id },
                data: {
                    punchIn,
                    punchOut,
                    status: dto.status ?? existing.status,
                    approvalStatus: newApprovalStatus,
                    approverId: resetToPending ? null : existing.approverId,
                    approvedAt: resetToPending ? null : existing.approvedAt,
                },
            });
            await tx.attendanceApprovalHistory.create({
                data: {
                    attendanceRecordId: id,
                    actorId: actor.id,
                    action: 'CORRECTED',
                    fromStatus: existing.approvalStatus,
                    toStatus: newApprovalStatus,
                    reason: dto.reason,
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `Attendance corrected for ${existing.employee.fullName}`,
                action: AuditAction.ATTENDANCE_CORRECTED,
                before: existing,
                after: rec,
            });
            return rec;
        });
        return updated;
    }
    async approve(actor, id) {
        const existing = await this.prisma.attendanceRecord.findUnique({
            where: { id },
            include: { employee: { include: { role: true } } },
        });
        if (!existing)
            throw ApiError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found');
        if (existing.approvalStatus !== ApprovalStatus.PENDING) {
            throw ApiError.conflict('ATTENDANCE_ALREADY_DECIDED', 'Attendance has already been decided');
        }
        if (actor.id === existing.employeeId) {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot approve your own attendance');
        }
        if (actor.roleCode !== 'FOUNDER') {
            if (!outranks(actor.roleCode, existing.employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only approve attendance for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const rec = await tx.attendanceRecord.update({
                where: { id },
                data: {
                    approvalStatus: ApprovalStatus.APPROVED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: null,
                },
            });
            await tx.attendanceApprovalHistory.create({
                data: {
                    attendanceRecordId: id,
                    actorId: actor.id,
                    action: 'APPROVED',
                    fromStatus: existing.approvalStatus,
                    toStatus: ApprovalStatus.APPROVED,
                    reason: 'Approved by manager/founder',
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: NotificationType.ATTENDANCE_STATUS,
                    title: 'Attendance Approved',
                    message: `Your attendance for ${existing.date.toISOString().slice(0, 10)} has been approved.`,
                    data: { attendanceId: id, status: 'APPROVED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `${existing.employee.fullName} attendance approved`,
                action: AuditAction.ATTENDANCE_APPROVED,
                before: existing,
                after: rec,
            });
            return rec;
        });
        return updated;
    }
    async reject(actor, id, dto) {
        if (!dto.reason || dto.reason.trim().length < 5) {
            throw ApiError.badRequest('REASON_REQUIRED', 'Rejection reason is required (minimum 5 characters)');
        }
        const existing = await this.prisma.attendanceRecord.findUnique({
            where: { id },
            include: { employee: { include: { role: true } } },
        });
        if (!existing)
            throw ApiError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found');
        if (existing.approvalStatus !== ApprovalStatus.PENDING) {
            throw ApiError.conflict('ATTENDANCE_ALREADY_DECIDED', 'Attendance has already been decided');
        }
        if (actor.id === existing.employeeId) {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot reject your own attendance');
        }
        if (actor.roleCode !== 'FOUNDER') {
            if (!outranks(actor.roleCode, existing.employee.role.code)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only reject attendance for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const rec = await tx.attendanceRecord.update({
                where: { id },
                data: {
                    approvalStatus: ApprovalStatus.REJECTED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                    rejectionReason: dto.reason,
                },
            });
            await tx.attendanceApprovalHistory.create({
                data: {
                    attendanceRecordId: id,
                    actorId: actor.id,
                    action: 'REJECTED',
                    fromStatus: existing.approvalStatus,
                    toStatus: ApprovalStatus.REJECTED,
                    reason: dto.reason,
                },
            });
            await tx.appNotification.create({
                data: {
                    recipientId: existing.employeeId,
                    type: NotificationType.ATTENDANCE_STATUS,
                    title: 'Attendance Rejected',
                    message: `Your attendance for ${existing.date.toISOString().slice(0, 10)} was rejected: ${dto.reason}`,
                    data: { attendanceId: id, status: 'REJECTED' },
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: `${existing.employee.fullName} attendance rejected`,
                action: AuditAction.ATTENDANCE_REJECTED,
                before: existing,
                after: rec,
            });
            return rec;
        });
        return updated;
    }
    async getRoster(actor) {
        const employees = await this.prisma.employee.findMany({
            where: { status: 'ACTIVE', role: { code: { not: 'FOUNDER' } } },
            select: {
                id: true,
                fullName: true,
                employeeCode: true,
                designation: true,
                department: true,
            },
            orderBy: { fullName: 'asc' },
        });
        return { items: employees };
    }
    async handleEsslWebhook(secret, dto) {
        const expectedSecret = process.env.ESSL_WEBHOOK_SECRET || 'dev-essl-webhook-secret';
        if (!secret || secret !== expectedSecret) {
            throw ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Invalid ESSL webhook secret');
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.deviceId);
        const device = await this.prisma.esslDevice.findFirst({
            where: isUuid ? { OR: [{ id: dto.deviceId }, { deviceCode: dto.deviceId }] } : { deviceCode: dto.deviceId },
            include: { mappings: true },
        });
        if (!device) {
            throw ApiError.badRequest('UNMAPPED_DEVICE', 'Device is not registered in the system');
        }
        let processedCount = 0;
        let duplicateCount = 0;
        let exceptionCount = 0;
        const mappingMap = new Map();
        for (const m of device.mappings) {
            mappingMap.set(m.biometricPin, m.employeeId);
        }
        for (const punch of dto.punches) {
            const punchTime = new Date(punch.punchAt);
            const sixtySecBefore = new Date(punchTime.getTime() - 60000);
            const sixtySecAfter = new Date(punchTime.getTime() + 60000);
            // Check 60s duplicate
            const existingPunch = await this.prisma.esslPunch.findFirst({
                where: {
                    deviceId: device.deviceCode,
                    externalBiometricId: punch.externalBiometricId,
                    punchAt: { gte: sixtySecBefore, lte: sixtySecAfter },
                },
            });
            if (existingPunch) {
                duplicateCount++;
                continue;
            }
            const employeeId = mappingMap.get(punch.externalBiometricId) ?? null;
            const createdPunch = await this.prisma.esslPunch.create({
                data: {
                    deviceId: device.deviceCode,
                    externalBiometricId: punch.externalBiometricId,
                    punchAt: punchTime,
                    punchType: punch.punchType ?? 'UNKNOWN',
                    employeeId,
                    rawPayload: punch,
                    receivedAt: new Date(),
                    processedAt: new Date(),
                },
            });
            if (employeeId) {
                // Daily attendance aggregation
                const dateOnly = new Date(Date.UTC(punchTime.getUTCFullYear(), punchTime.getUTCMonth(), punchTime.getUTCDate()));
                const dayPunches = await this.prisma.esslPunch.findMany({
                    where: {
                        employeeId,
                        punchAt: {
                            gte: dateOnly,
                            lte: new Date(dateOnly.getTime() + 86399999),
                        },
                    },
                    orderBy: { punchAt: 'asc' },
                });
                const firstPunch = dayPunches[0]?.punchAt;
                const lastPunch = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1]?.punchAt : null;
                let hasException = false;
                let exceptionType = null;
                if (dayPunches.length === 1) {
                    hasException = true;
                    exceptionType = 'MISSING_PUNCH';
                    exceptionCount++;
                }
                else if (lastPunch && firstPunch && lastPunch < firstPunch) {
                    hasException = true;
                    exceptionType = 'SEQUENCE_ERROR';
                    exceptionCount++;
                }
                await this.prisma.attendanceRecord.upsert({
                    where: {
                        employeeId_date: {
                            employeeId,
                            date: dateOnly,
                        },
                    },
                    create: {
                        employeeId,
                        date: dateOnly,
                        status: AttendanceStatus.PRESENT,
                        source: AttendanceSource.ESSL,
                        punchIn: firstPunch,
                        punchOut: lastPunch,
                        checkInDevice: device.name,
                        approvalStatus: ApprovalStatus.PENDING,
                        hasException,
                        exceptionType,
                        sourceEsslPunchIds: dayPunches.map((p) => p.id),
                    },
                    update: {
                        punchIn: firstPunch,
                        punchOut: lastPunch,
                        hasException,
                        exceptionType,
                        sourceEsslPunchIds: dayPunches.map((p) => p.id),
                    },
                });
            }
            processedCount++;
        }
        return { processed: processedCount, duplicates: duplicateCount, exceptions: exceptionCount };
    }
    async syncEssl(actor, dto) {
        if (actor.roleCode === 'AGENT') {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Agents cannot trigger biometric hardware sync');
        }
        const devices = await this.prisma.esslDevice.findMany({
            where: { isActive: true },
            include: { mappings: { include: { employee: true } } },
        });
        if (devices.length === 0) {
            throw ApiError.badRequest('NO_DEVICES', 'No active ESSL devices configured');
        }
        const targetDateStr = dto.date || new Date().toISOString().slice(0, 10);
        const targetDate = parseDateOnly(targetDateStr);
        let punchesToProcess = dto.punches;
        if (!punchesToProcess || punchesToProcess.length === 0) {
            punchesToProcess = [];
            for (const device of devices) {
                for (const mapping of device.mappings) {
                    const inTime = new Date(`${targetDateStr}T09:15:00.000Z`);
                    const outTime = new Date(`${targetDateStr}T18:05:00.000Z`);
                    punchesToProcess.push({
                        deviceCode: device.deviceCode,
                        biometricPin: mapping.biometricPin,
                        punchTime: inTime.toISOString(),
                        punchType: 'IN',
                    });
                    punchesToProcess.push({
                        deviceCode: device.deviceCode,
                        biometricPin: mapping.biometricPin,
                        punchTime: outTime.toISOString(),
                        punchType: 'OUT',
                    });
                }
            }
        }
        const results = await this.prisma.$transaction(async (tx) => {
            const records = [];
            for (const p of punchesToProcess) {
                const device = devices.find((d) => d.deviceCode === p.deviceCode);
                const mapping = device?.mappings.find((m) => m.biometricPin === p.biometricPin);
                if (!mapping)
                    continue;
                const punchTime = new Date(p.punchTime);
                const isOut = p.punchType === 'OUT';
                const record = await tx.attendanceRecord.upsert({
                    where: {
                        employeeId_date: {
                            employeeId: mapping.employeeId,
                            date: targetDate,
                        },
                    },
                    create: {
                        employeeId: mapping.employeeId,
                        date: targetDate,
                        status: AttendanceStatus.PRESENT,
                        source: AttendanceSource.ESSL,
                        punchIn: isOut ? null : punchTime,
                        punchOut: isOut ? punchTime : null,
                        checkInDevice: device?.name ?? p.deviceCode,
                        approvalStatus: ApprovalStatus.PENDING,
                    },
                    update: isOut ? { punchOut: punchTime } : { punchIn: punchTime },
                });
                records.push(record);
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: actor.id,
                entityLabel: `Synced ESSL attendance (${records.length} punches)`,
                action: AuditAction.ATTENDANCE_SYNCED_ESSL,
                after: { punchesCount: records.length, date: targetDateStr },
            });
            return records;
        });
        return { synced: results.length, date: targetDateStr };
    }
    async getDevices() {
        return this.prisma.esslDevice.findMany({
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { mappings: true } } },
        });
    }
    async createDevice(dto) {
        const existing = await this.prisma.esslDevice.findUnique({ where: { deviceCode: dto.deviceCode } });
        if (existing)
            throw ApiError.conflict('DEVICE_EXISTS', 'Device code already registered');
        return this.prisma.esslDevice.create({ data: dto });
    }
    async getMappings(deviceId) {
        return this.prisma.esslDeviceMapping.findMany({
            where: deviceId ? { deviceId } : {},
            include: {
                device: true,
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
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createMapping(dto) {
        const existing = await this.prisma.esslDeviceMapping.findUnique({
            where: {
                deviceId_biometricPin: {
                    deviceId: dto.deviceId,
                    biometricPin: dto.biometricPin,
                },
            },
        });
        if (existing)
            throw ApiError.conflict('MAPPING_EXISTS', 'Biometric PIN already mapped on this device');
        return this.prisma.esslDeviceMapping.create({
            data: dto,
            include: {
                employee: { select: { id: true, fullName: true, employeeCode: true } },
                device: true,
            },
        });
    }
};
AttendanceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], AttendanceService);
export { AttendanceService };
