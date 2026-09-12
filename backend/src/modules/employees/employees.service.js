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
import { EmployeeEmploymentStatus, EmployeeHistoryType, EmployeeStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType, isTopTier, outranks } from '@grotec/shared';
import { toPage } from '../../common/utils/pagination';
import { hashPassword } from '../auth/password.util';
const ALLOWED_DOCUMENT_MIMES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const EMPLOYEE_SELECT = {
    id: true,
    email: true,
    fullName: true,
    phone: true,
    status: true,
    employmentStatus: true,
    lastLoginAt: true,
    createdAt: true,
    role: { select: { id: true, code: true, name: true } },
    employeeCode: true,
    designation: true,
    department: true,
    reportingManagerId: true,
    reportingManager: { select: { id: true, fullName: true, email: true } },
    joiningDate: true,
    experience: true,
    address: true,
    notes: true,
};
let EmployeesService = class EmployeesService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(actor, pagination, filters) {
        const conditions = [{ deletedAt: null }];
        if (isTopTier(actor.roleCode)) {
            // Full visibility
        }
        else if (actor.roleCode === 'MANAGER') {
            conditions.push({
                OR: [
                    { id: actor.id },
                    { role: { code: { in: ['AGENT', 'STAFF', 'DELIVERY'] } } },
                ],
            });
        }
        else if (actor.roleCode === 'STAFF') {
            conditions.push({
                OR: [
                    { id: actor.id },
                    { assignedStaffs: { some: { staffEmployeeId: actor.id } } },
                ],
            });
        }
        else {
            conditions.push({ id: actor.id });
        }
        if (filters.q) {
            conditions.push({
                OR: [
                    { fullName: { contains: filters.q, mode: 'insensitive' } },
                    { email: { contains: filters.q, mode: 'insensitive' } },
                    { employeeCode: { contains: filters.q, mode: 'insensitive' } },
                ],
            });
        }
        if (filters.status)
            conditions.push({ status: filters.status });
        if (filters.employmentStatus)
            conditions.push({ employmentStatus: filters.employmentStatus });
        if (filters.roleCode)
            conditions.push({ role: { code: filters.roleCode } });
        if (filters.department)
            conditions.push({ department: { equals: filters.department, mode: 'insensitive' } });
        if (filters.designation)
            conditions.push({ designation: { equals: filters.designation, mode: 'insensitive' } });
        const where = { AND: conditions };
        let orderBy = { createdAt: 'desc' };
        if (filters.sort) {
            const [field, direction] = filters.sort.split(':');
            const dir = direction?.toLowerCase() === 'asc' ? 'asc' : 'desc';
            if (['createdAt', 'fullName', 'employeeCode', 'department', 'designation', 'joiningDate'].includes(field)) {
                orderBy = { [field]: dir };
            }
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employee.findMany({
                where,
                select: EMPLOYEE_SELECT,
                orderBy,
                skip: pagination.skip,
                take: pagination.take,
            }),
            this.prisma.employee.count({ where }),
        ]);
        return toPage(items, total, pagination);
    }
    // All roles in the system (including ones no employee currently holds,
    // like a freshly-added SUPER_ADMIN) — the source for the role-assignment
    // dropdown on create/update. What an actor may actually ASSIGN is a
    // separate, narrower check (assertRoleAssignmentAllowed) enforced at
    // create/update time; this listing is deliberately unfiltered so the
    // dropdown always reflects every role that exists.
    async listRoles(actor) {
        return this.prisma.role.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { name: 'asc' },
        });
    }
    async get(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            select: EMPLOYEE_SELECT,
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        return employee;
    }
    async create(actor, dto) {
        const email = dto.email.trim().toLowerCase();
        await this.assertEmailAvailable(email);
        const role = await this.requireRole(dto.roleId);
        this.assertRoleAssignmentAllowed(actor, role.code);
        if (dto.joiningDate) {
            const jd = new Date(dto.joiningDate);
            if (isNaN(jd.getTime()))
                throw ApiError.badRequest('INVALID_DATE', 'Invalid joining date');
            if (jd > new Date()) {
                throw ApiError.badRequest('JOINING_DATE_IN_FUTURE', 'Joining date cannot be in the future');
            }
        }
        if (dto.reportingManagerId) {
            const mgr = await this.prisma.employee.findFirst({
                where: { id: dto.reportingManagerId, deletedAt: null },
            });
            if (!mgr)
                throw ApiError.badRequest('REPORTING_MANAGER_NOT_FOUND', 'Reporting manager not found');
        }
        const temporaryPassword = dto.password ? undefined : generateTemporaryPassword();
        const passwordHash = await hashPassword(dto.password ?? temporaryPassword);
        const created = await this.prisma.$transaction(async (tx) => {
            let employeeCode = dto.employeeCode?.trim();
            if (!employeeCode) {
                const [seqRes] = await tx.$queryRaw `SELECT nextval('employee_code_seq')::bigint AS nextval`;
                const seqNum = Number(seqRes?.nextval ?? 1);
                employeeCode = `GE${String(seqNum).padStart(5, '0')}`;
            }
            else {
                const existingCode = await tx.employee.findUnique({ where: { employeeCode } });
                if (existingCode)
                    throw ApiError.conflict('EMPLOYEE_CODE_EXISTS', 'Employee code already exists');
            }
            const employee = await tx.employee.create({
                data: {
                    email,
                    fullName: dto.fullName,
                    phone: dto.phone ?? null,
                    passwordHash,
                    roleId: role.id,
                    createdById: actor.id,
                    employeeCode,
                    designation: dto.designation ?? null,
                    department: dto.department ?? null,
                    reportingManagerId: dto.reportingManagerId ?? null,
                    joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
                    experience: dto.experience ?? null,
                    address: dto.address ?? null,
                    notes: dto.notes ?? null,
                    employmentStatus: dto.employmentStatus ?? EmployeeEmploymentStatus.ACTIVE,
                },
                select: EMPLOYEE_SELECT,
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: employee.id,
                entityLabel: employee.email,
                action: AuditAction.CREATED,
                after: { email, fullName: dto.fullName, roleCode: role.code, employeeCode },
            });
            return employee;
        });
        return { employee: created, temporaryPassword };
    }
    async update(actor, id, dto) {
        const existing = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!existing)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        const isSelf = actor.id === id;
        if (isSelf) {
            const forbiddenFields = [
                dto.email,
                dto.fullName,
                dto.roleId,
                dto.employeeCode,
                dto.designation,
                dto.department,
                dto.reportingManagerId,
                dto.joiningDate,
                dto.experience,
                dto.notes,
                dto.employmentStatus,
            ];
            if (forbiddenFields.some((f) => f !== undefined)) {
                throw ApiError.forbidden('SELF_UPDATE_RESTRICTED', 'Employees may only update their own phone and address');
            }
        }
        else {
            await this.assertCanAccessEmployee(actor, existing.id, existing.role.code);
        }
        if (dto.reportingManagerId !== undefined && dto.reportingManagerId !== null) {
            if (dto.reportingManagerId === id) {
                throw ApiError.badRequest('SELF_REPORTING_NOT_ALLOWED', 'An employee cannot be their own reporting manager');
            }
            const mgr = await this.prisma.employee.findFirst({
                where: { id: dto.reportingManagerId, deletedAt: null },
            });
            if (!mgr)
                throw ApiError.badRequest('REPORTING_MANAGER_NOT_FOUND', 'Reporting manager not found');
            const totalCount = await this.prisma.employee.count();
            let currId = dto.reportingManagerId;
            let steps = 0;
            while (currId && steps <= totalCount) {
                if (currId === id) {
                    throw ApiError.badRequest('REPORTING_CYCLE_DETECTED', 'A cycle was detected in the reporting hierarchy');
                }
                const parentRecord = await this.prisma.employee.findUnique({
                    where: { id: currId },
                    select: { reportingManagerId: true },
                });
                currId = parentRecord?.reportingManagerId ?? null;
                steps++;
            }
            if (steps > totalCount) {
                throw ApiError.badRequest('REPORTING_CYCLE_DETECTED', 'A cycle was detected in the reporting hierarchy');
            }
        }
        if (dto.joiningDate) {
            const jd = new Date(dto.joiningDate);
            if (isNaN(jd.getTime()))
                throw ApiError.badRequest('INVALID_DATE', 'Invalid joining date');
            if (jd > new Date()) {
                throw ApiError.badRequest('JOINING_DATE_IN_FUTURE', 'Joining date cannot be in the future');
            }
        }
        const email = dto.email?.trim().toLowerCase();
        if (email && email !== existing.email)
            await this.assertEmailAvailable(email);
        let roleId = dto.roleId;
        if (dto.roleId && dto.roleId !== existing.roleId) {
            const role = await this.requireRole(dto.roleId);
            this.assertRoleAssignmentAllowed(actor, role.code);
            roleId = role.id;
        }
        const isTerminating = dto.employmentStatus === EmployeeEmploymentStatus.TERMINATED &&
            existing.employmentStatus !== EmployeeEmploymentStatus.TERMINATED;
        const updated = await this.prisma.$transaction(async (tx) => {
            const employee = await tx.employee.update({
                where: { id },
                data: {
                    email: email ?? undefined,
                    fullName: dto.fullName ?? undefined,
                    phone: dto.phone === undefined ? undefined : dto.phone,
                    roleId,
                    employeeCode: dto.employeeCode === undefined ? undefined : dto.employeeCode,
                    designation: dto.designation === undefined ? undefined : dto.designation,
                    department: dto.department === undefined ? undefined : dto.department,
                    reportingManagerId: dto.reportingManagerId === undefined ? undefined : dto.reportingManagerId,
                    joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : (dto.joiningDate === null ? null : undefined),
                    experience: dto.experience === undefined ? undefined : dto.experience,
                    address: dto.address === undefined ? undefined : dto.address,
                    notes: dto.notes === undefined ? undefined : dto.notes,
                    employmentStatus: dto.employmentStatus,
                    status: isTerminating ? EmployeeStatus.INACTIVE : undefined,
                },
                select: EMPLOYEE_SELECT,
            });
            if (isTerminating) {
                await tx.authSession.updateMany({
                    where: { employeeId: id },
                    data: { revokedAt: new Date() },
                });
                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.EMPLOYEE,
                    entityId: employee.id,
                    entityLabel: employee.email,
                    action: AuditAction.TERMINATED,
                    before: { employmentStatus: existing.employmentStatus, status: existing.status },
                    after: { employmentStatus: EmployeeEmploymentStatus.TERMINATED, status: EmployeeStatus.INACTIVE },
                });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: employee.id,
                entityLabel: employee.email,
                action: AuditAction.UPDATED,
                before: {
                    email: existing.email,
                    fullName: existing.fullName,
                    phone: existing.phone,
                    roleId: existing.roleId,
                    employmentStatus: existing.employmentStatus,
                },
                after: { email, fullName: dto.fullName, phone: dto.phone, roleId, employmentStatus: dto.employmentStatus },
            });
            return employee;
        });
        return updated;
    }
    async getProfile(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            select: {
                ...EMPLOYEE_SELECT,
                salaryRevisions: {
                    orderBy: { revisionNumber: 'desc' },
                    take: 1,
                },
            },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        const canSeeFinancials = this.canAccessFinancials(actor, employee.id, employee.role.code);
        const canSeePerformance = this.canAccessPerformance(actor, employee.id, employee.role.code);
        const currentSalary = canSeeFinancials ? (employee.salaryRevisions[0] ?? null) : null;
        return {
            overview: {
                ...employee,
                currentSalary,
            },
            permissions: {
                canSeeFinancials,
                canSeePerformance,
            },
        };
    }
    async getProfilePerformance(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessPerformance(actor, employee.id, employee.role.code)) {
            throw ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to performance profile section is forbidden');
        }
        const calls = await this.prisma.call.findMany({
            where: { agentId: id },
            select: { status: true, outcome: true, startedAt: true },
        });
        const callsDialed = calls.length;
        const callsConnected = calls.filter((c) => c.status === 'CONNECTED' || c.status === 'ENDED').length;
        const leadsConverted = await this.prisma.relationshipOwnership.count({
            where: { assignedById: id, reason: 'conversion_sales' },
        });
        const conversionRate = callsDialed > 0 ? Number(((leadsConverted / callsDialed) * 100).toFixed(1)) : 0;
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const kpiTargets = await this.prisma.kpiTarget.findMany({
            where: { employeeId: id, period: currentPeriod },
        });
        const kpiScore = await this.prisma.kpiPeriodScore.findUnique({
            where: { employeeId_period: { employeeId: id, period: currentPeriod } },
            include: { reviewEntries: true },
        });
        return {
            crmMetrics: {
                callsDialed,
                callsConnected,
                leadsConverted,
                conversionRate,
                totalRevenue: null,
                revenueStatus: 'PENDING_SOURCE_PHASE_2',
            },
            kpiTargets,
            kpiScore,
        };
    }
    async getProfileAttendance(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        const recentAttendance = await this.prisma.attendanceRecord.findMany({
            where: { employeeId: id },
            orderBy: { date: 'desc' },
            take: 30,
        });
        const stats = {
            present: recentAttendance.filter((a) => a.status === 'PRESENT').length,
            absent: recentAttendance.filter((a) => a.status === 'ABSENT').length,
            halfDay: recentAttendance.filter((a) => a.status === 'HALF_DAY').length,
            late: recentAttendance.filter((a) => a.status === 'LATE').length,
            leave: recentAttendance.filter((a) => a.status === 'LEAVE').length,
        };
        return { stats, records: recentAttendance };
    }
    async getProfileLeave(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        const currentYear = new Date().getFullYear();
        const balances = await this.prisma.leaveBalance.findMany({
            where: { employeeId: id, year: currentYear },
            include: { leaveType: true },
        });
        const applications = await this.prisma.leaveApplication.findMany({
            where: { employeeId: id },
            include: { leaveType: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return { balances, applications };
    }
    async getProfileSalary(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessFinancials(actor, employee.id, employee.role.code)) {
            throw ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to salary profile section is forbidden');
        }
        const revisions = await this.prisma.salaryRevision.findMany({
            where: { employeeId: id },
            include: { componentsList: true },
            orderBy: { revisionNumber: 'desc' },
        });
        const payslips = await this.prisma.payrollLineItem.findMany({
            where: { employeeId: id, payrollRun: { status: 'PUBLISHED' } },
            include: { payrollRun: true },
            orderBy: { createdAt: 'desc' },
        });
        return { revisions, payslips };
    }
    async getProfileAdvances(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessFinancials(actor, employee.id, employee.role.code)) {
            throw ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to advances profile section is forbidden');
        }
        const advances = await this.prisma.advanceLedger.findMany({
            where: { employeeId: id },
            include: { recoveries: true },
            orderBy: { issuedAt: 'desc' },
        });
        const runningBalanceTotal = advances.reduce((sum, a) => sum + Number(a.runningBalance), 0);
        return { runningBalanceTotal, records: advances };
    }
    async getProfileHistory(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        const history = await this.prisma.employeeHistoryRecord.findMany({
            where: { employeeId: id },
            orderBy: { date: 'desc' },
        });
        return history;
    }
    async getProfileDocuments(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!employee)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, employee.id, employee.role.code);
        const documents = await this.prisma.employeeDocument.findMany({
            where: { employeeId: id, deletedAt: null },
            include: { uploadedBy: { select: { id: true, fullName: true, email: true } } },
            orderBy: { uploadedAt: 'desc' },
        });
        return documents;
    }
    async addDocument(actor, employeeId, dto) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        if (dto.mimeType && !ALLOWED_DOCUMENT_MIMES.has(dto.mimeType)) {
            throw ApiError.badRequest('UNSUPPORTED_FILE_TYPE', `Unsupported document MIME type ${dto.mimeType}`);
        }
        const size = dto.fileSizeBytes ?? dto.fileSize;
        if (size > MAX_DOCUMENT_SIZE) {
            throw ApiError.badRequest('FILE_TOO_LARGE', 'Document size exceeds 10MB limit');
        }
        const doc = await this.prisma.employeeDocument.create({
            data: {
                employeeId,
                fileName: dto.fileName,
                fileType: dto.fileType,
                mimeType: dto.mimeType ?? 'application/pdf',
                fileSize: dto.fileSize,
                fileSizeBytes: size,
                fileUrl: dto.fileUrl,
                uploadedById: actor.id,
            },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Document: ${dto.fileName}`,
            action: AuditAction.DOCUMENT_UPLOADED,
            after: { documentId: doc.id, fileName: dto.fileName, fileSize: size },
        });
        return doc;
    }
    async deleteDocument(actor, employeeId, documentId) {
        const doc = await this.prisma.employeeDocument.findFirst({
            where: { id: documentId, employeeId, deletedAt: null },
        });
        if (!doc)
            throw ApiError.notFound('DOCUMENT_NOT_FOUND', 'Document not found');
        if (!isTopTier(actor.roleCode) && doc.uploadedById !== actor.id) {
            throw ApiError.forbidden('DOCUMENT_DELETE_FORBIDDEN', 'Only the uploader or Founder may delete this document');
        }
        const updated = await this.prisma.employeeDocument.update({
            where: { id: documentId },
            data: { deletedAt: new Date() },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Document Deleted: ${doc.fileName}`,
            action: AuditAction.DOCUMENT_DELETED,
            after: { documentId, deletedAt: updated.deletedAt },
        });
        return { success: true };
    }
    async createNote(actor, employeeId, dto) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        const note = await this.prisma.employeeNote.create({
            data: {
                employeeId,
                authorId: actor.id,
                body: dto.content,
            },
            include: {
                author: { select: { id: true, fullName: true, email: true } },
            },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: 'Employee Note Added',
            action: AuditAction.EMPLOYEE_NOTE_ADDED,
            after: { noteId: note.id },
        });
        return note;
    }
    async listNotes(actor, employeeId) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        return this.prisma.employeeNote.findMany({
            where: { employeeId },
            include: {
                author: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async addHistory(actor, employeeId, dto) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        if (dto.description.trim().length < 5) {
            throw ApiError.badRequest('DESCRIPTION_TOO_SHORT', 'History description must be at least 5 characters');
        }
        const record = await this.prisma.employeeHistoryRecord.create({
            data: {
                employeeId,
                type: dto.type,
                date: new Date(dto.date),
                description: dto.description,
                addedBy: actor.fullName,
            },
        });
        const isDisciplinary = dto.type === EmployeeHistoryType.WARNING;
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Employee History: ${dto.type}`,
            action: isDisciplinary ? AuditAction.DISCIPLINARY : AuditAction.HISTORY_RECORDED,
            after: { historyId: record.id, type: dto.type, description: dto.description },
        });
        return record;
    }
    async assignStaff(actor, employeeId, staffEmployeeId) {
        if (!isTopTier(actor.roleCode) && actor.roleCode !== 'MANAGER') {
            throw ApiError.forbidden('FORBIDDEN', 'Only Founder and Manager can assign staff');
        }
        const [target, staff] = await Promise.all([
            this.prisma.employee.findUnique({ where: { id: employeeId } }),
            this.prisma.employee.findUnique({ where: { id: staffEmployeeId }, include: { role: true } }),
        ]);
        if (!target)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (!staff)
            throw ApiError.notFound('STAFF_NOT_FOUND', 'Staff employee not found');
        if (staff.role.code !== 'STAFF') {
            throw ApiError.badRequest('INVALID_ROLE', 'Assigned employee must have STAFF role');
        }
        return this.prisma.employeeAssignment.upsert({
            where: {
                staffEmployeeId_assignedEmployeeId: {
                    staffEmployeeId,
                    assignedEmployeeId: employeeId,
                },
            },
            create: {
                staffEmployeeId,
                assignedEmployeeId: employeeId,
            },
            update: {},
            include: {
                staffEmployee: { select: { id: true, fullName: true, email: true } },
            },
        });
    }
    async unassignStaff(actor, employeeId, staffEmployeeId) {
        if (!isTopTier(actor.roleCode) && actor.roleCode !== 'MANAGER') {
            throw ApiError.forbidden('FORBIDDEN', 'Only Founder and Manager can unassign staff');
        }
        await this.prisma.employeeAssignment.deleteMany({
            where: { staffEmployeeId, assignedEmployeeId: employeeId },
        });
        return { success: true };
    }
    async listAssignments(actor, employeeId) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        return this.prisma.employeeAssignment.findMany({
            where: { assignedEmployeeId: employeeId },
            include: { staffEmployee: { select: { id: true, fullName: true, email: true } } },
        });
    }
    async setActive(actor, id, active) {
        if (!isTopTier(actor.roleCode)) {
            throw ApiError.forbidden('FOUNDER_ONLY', 'Only the founder can activate or deactivate employees (PRD §5.1.2)');
        }
        const existing = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!existing)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (existing.role?.code === 'FOUNDER' && !active && actor.roleCode !== 'SUPER_ADMIN') {
            throw ApiError.forbidden('FOUNDER_PROTECTED', 'Cannot deactivate the Founder account');
        }
        if (existing.role?.code === 'SUPER_ADMIN' && !active && actor.roleCode !== 'SUPER_ADMIN') {
            throw ApiError.forbidden('SUPER_ADMIN_PROTECTED', 'Only a Super Admin can deactivate a Super Admin account');
        }
        if (!active && existing.id === actor.id) {
            throw ApiError.badRequest('SELF_DEACTIVATION', 'You cannot deactivate your own account');
        }
        const employee = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.employee.update({
                where: { id },
                data: { status: active ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE },
                select: EMPLOYEE_SELECT,
            });
            if (!active) {
                await tx.authSession.updateMany({ where: { employeeId: id }, data: { revokedAt: new Date() } });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: existing.email,
                action: active ? AuditAction.ACTIVATED : AuditAction.DEACTIVATED,
                after: { status: active ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE },
            });
            return updated;
        });
        return employee;
    }
    async resetPassword(actor, id, dto) {
        if (!isTopTier(actor.roleCode)) {
            throw ApiError.forbidden('FOUNDER_ONLY', 'Only the founder can reset employee passwords (PRD §5.1.2)');
        }
        const existing = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!existing)
            throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        // Founder's password is protected from everyone except Super Admin, the
        // one role meant to have no dead-ends. Super Admin's own password gets
        // the same symmetric protection from everyone but another Super Admin.
        if (existing.role?.code === 'FOUNDER' && actor.roleCode !== 'SUPER_ADMIN') {
            throw ApiError.forbidden('FOUNDER_PROTECTED', 'Cannot reset Founder password');
        }
        if (existing.role?.code === 'SUPER_ADMIN' && actor.roleCode !== 'SUPER_ADMIN') {
            throw ApiError.forbidden('SUPER_ADMIN_PROTECTED', 'Only a Super Admin can reset a Super Admin password');
        }
        const generated = dto.newPassword ? undefined : generateTemporaryPassword();
        const passwordHash = await hashPassword(dto.newPassword ?? generated);
        await this.prisma.$transaction(async (tx) => {
            await tx.employee.update({ where: { id }, data: { passwordHash } });
            await tx.authSession.updateMany({ where: { employeeId: id }, data: { revokedAt: new Date() } });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: existing.email,
                action: AuditAction.PASSWORD_CHANGED,
                meta: { by: 'admin_reset' },
            });
        });
        return generated ? { temporaryPassword: generated } : {};
    }
    async assertCanAccessEmployee(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return;
        if (isTopTier(actor.roleCode))
            return;
        if (actor.roleCode === 'MANAGER') {
            if (!outranks(actor.roleCode, targetRoleCode)) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only access employees strictly below your rank (PRD §5.1.2)');
            }
            return;
        }
        if (actor.roleCode === 'STAFF') {
            const assignment = await this.prisma.employeeAssignment.findUnique({
                where: {
                    staffEmployeeId_assignedEmployeeId: {
                        staffEmployeeId: actor.id,
                        assignedEmployeeId: targetId,
                    },
                },
            });
            if (!assignment) {
                throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You do not have access to this employee');
            }
            return;
        }
        throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You do not have access to this employee');
    }
    canAccessFinancials(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return true;
        if (isTopTier(actor.roleCode))
            return true;
        if (actor.roleCode === 'MANAGER' && outranks(actor.roleCode, targetRoleCode))
            return true;
        return false;
    }
    canAccessPerformance(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return true;
        if (isTopTier(actor.roleCode))
            return true;
        if (actor.roleCode === 'MANAGER' && outranks(actor.roleCode, targetRoleCode))
            return true;
        return false;
    }
    async assertEmailAvailable(email) {
        const found = await this.prisma.employee.findUnique({ where: { email } });
        if (found)
            throw ApiError.conflict('EMPLOYEE_EMAIL_EXISTS', 'An employee with this email already exists');
    }
    async requireRole(roleId) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            throw ApiError.badRequest('ROLE_NOT_FOUND', 'Role does not exist');
        return role;
    }
    assertRoleAssignmentAllowed(actor, targetRoleCode) {
        if (actor.roleCode === 'SUPER_ADMIN')
            return;
        if (targetRoleCode === 'SUPER_ADMIN') {
            throw ApiError.forbidden('ROLE_ASSIGNMENT_FORBIDDEN', 'Only a Super Admin may assign the Super Admin role');
        }
        if (actor.roleCode === 'FOUNDER')
            return;
        if (targetRoleCode === 'FOUNDER') {
            throw ApiError.forbidden('ROLE_ASSIGNMENT_FORBIDDEN', 'Only founders may assign the founder role (PRD §5.1.2)');
        }
        if (!outranks(actor.roleCode, targetRoleCode)) {
            throw ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only assign roles strictly below your rank (PRD §5.1.2)');
        }
    }
};
EmployeesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], EmployeesService);
export { EmployeesService };
function generateTemporaryPassword() {
    return randomBytes(9).toString('base64url');
}
