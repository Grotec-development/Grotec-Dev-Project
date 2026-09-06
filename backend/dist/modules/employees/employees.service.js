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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const shared_1 = require("@grotec/shared");
const pagination_1 = require("../../common/utils/pagination");
const password_util_1 = require("../auth/password.util");
const ALLOWED_DOCUMENT_MIMES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
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
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(actor, pagination, filters) {
        const conditions = [{ deletedAt: null }];
        if (actor.roleCode === 'FOUNDER') {
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
        return (0, pagination_1.toPage)(items, total, pagination);
    }
    async get(actor, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            select: EMPLOYEE_SELECT,
        });
        if (!employee)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
                throw api_error_1.ApiError.badRequest('INVALID_DATE', 'Invalid joining date');
            if (jd > new Date()) {
                throw api_error_1.ApiError.badRequest('JOINING_DATE_IN_FUTURE', 'Joining date cannot be in the future');
            }
        }
        if (dto.reportingManagerId) {
            const mgr = await this.prisma.employee.findFirst({
                where: { id: dto.reportingManagerId, deletedAt: null },
            });
            if (!mgr)
                throw api_error_1.ApiError.badRequest('REPORTING_MANAGER_NOT_FOUND', 'Reporting manager not found');
        }
        const temporaryPassword = dto.password ? undefined : generateTemporaryPassword();
        const passwordHash = await (0, password_util_1.hashPassword)(dto.password ?? temporaryPassword);
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
                    throw api_error_1.ApiError.conflict('EMPLOYEE_CODE_EXISTS', 'Employee code already exists');
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
                    employmentStatus: dto.employmentStatus ?? client_1.EmployeeEmploymentStatus.ACTIVE,
                },
                select: EMPLOYEE_SELECT,
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: employee.id,
                entityLabel: employee.email,
                action: shared_1.AuditAction.CREATED,
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
                throw api_error_1.ApiError.forbidden('SELF_UPDATE_RESTRICTED', 'Employees may only update their own phone and address');
            }
        }
        else {
            await this.assertCanAccessEmployee(actor, existing.id, existing.role.code);
        }
        if (dto.reportingManagerId !== undefined && dto.reportingManagerId !== null) {
            if (dto.reportingManagerId === id) {
                throw api_error_1.ApiError.badRequest('SELF_REPORTING_NOT_ALLOWED', 'An employee cannot be their own reporting manager');
            }
            const mgr = await this.prisma.employee.findFirst({
                where: { id: dto.reportingManagerId, deletedAt: null },
            });
            if (!mgr)
                throw api_error_1.ApiError.badRequest('REPORTING_MANAGER_NOT_FOUND', 'Reporting manager not found');
            const totalCount = await this.prisma.employee.count();
            let currId = dto.reportingManagerId;
            let steps = 0;
            while (currId && steps <= totalCount) {
                if (currId === id) {
                    throw api_error_1.ApiError.badRequest('REPORTING_CYCLE_DETECTED', 'A cycle was detected in the reporting hierarchy');
                }
                const parentRecord = await this.prisma.employee.findUnique({
                    where: { id: currId },
                    select: { reportingManagerId: true },
                });
                currId = parentRecord?.reportingManagerId ?? null;
                steps++;
            }
            if (steps > totalCount) {
                throw api_error_1.ApiError.badRequest('REPORTING_CYCLE_DETECTED', 'A cycle was detected in the reporting hierarchy');
            }
        }
        if (dto.joiningDate) {
            const jd = new Date(dto.joiningDate);
            if (isNaN(jd.getTime()))
                throw api_error_1.ApiError.badRequest('INVALID_DATE', 'Invalid joining date');
            if (jd > new Date()) {
                throw api_error_1.ApiError.badRequest('JOINING_DATE_IN_FUTURE', 'Joining date cannot be in the future');
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
        const isTerminating = dto.employmentStatus === client_1.EmployeeEmploymentStatus.TERMINATED &&
            existing.employmentStatus !== client_1.EmployeeEmploymentStatus.TERMINATED;
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
                    status: isTerminating ? client_1.EmployeeStatus.INACTIVE : undefined,
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
                    entityType: shared_1.AuditEntityType.EMPLOYEE,
                    entityId: employee.id,
                    entityLabel: employee.email,
                    action: shared_1.AuditAction.TERMINATED,
                    before: { employmentStatus: existing.employmentStatus, status: existing.status },
                    after: { employmentStatus: client_1.EmployeeEmploymentStatus.TERMINATED, status: client_1.EmployeeStatus.INACTIVE },
                });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: employee.id,
                entityLabel: employee.email,
                action: shared_1.AuditAction.UPDATED,
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessPerformance(actor, employee.id, employee.role.code)) {
            throw api_error_1.ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to performance profile section is forbidden');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessFinancials(actor, employee.id, employee.role.code)) {
            throw api_error_1.ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to salary profile section is forbidden');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (!this.canAccessFinancials(actor, employee.id, employee.role.code)) {
            throw api_error_1.ApiError.forbidden('PROFILE_SECTION_FORBIDDEN', 'Access to advances profile section is forbidden');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        if (dto.mimeType && !ALLOWED_DOCUMENT_MIMES.has(dto.mimeType)) {
            throw api_error_1.ApiError.badRequest('UNSUPPORTED_FILE_TYPE', `Unsupported document MIME type ${dto.mimeType}`);
        }
        const size = dto.fileSizeBytes ?? dto.fileSize;
        if (size > MAX_DOCUMENT_SIZE) {
            throw api_error_1.ApiError.badRequest('FILE_TOO_LARGE', 'Document size exceeds 10MB limit');
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
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Document: ${dto.fileName}`,
            action: shared_1.AuditAction.DOCUMENT_UPLOADED,
            after: { documentId: doc.id, fileName: dto.fileName, fileSize: size },
        });
        return doc;
    }
    async deleteDocument(actor, employeeId, documentId) {
        const doc = await this.prisma.employeeDocument.findFirst({
            where: { id: documentId, employeeId, deletedAt: null },
        });
        if (!doc)
            throw api_error_1.ApiError.notFound('DOCUMENT_NOT_FOUND', 'Document not found');
        if (actor.roleCode !== 'FOUNDER' && doc.uploadedById !== actor.id) {
            throw api_error_1.ApiError.forbidden('DOCUMENT_DELETE_FORBIDDEN', 'Only the uploader or Founder may delete this document');
        }
        const updated = await this.prisma.employeeDocument.update({
            where: { id: documentId },
            data: { deletedAt: new Date() },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Document Deleted: ${doc.fileName}`,
            action: shared_1.AuditAction.DOCUMENT_DELETED,
            after: { documentId, deletedAt: updated.deletedAt },
        });
        return { success: true };
    }
    async createNote(actor, employeeId, dto) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: 'Employee Note Added',
            action: shared_1.AuditAction.EMPLOYEE_NOTE_ADDED,
            after: { noteId: note.id },
        });
        return note;
    }
    async listNotes(actor, employeeId) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        if (dto.description.trim().length < 5) {
            throw api_error_1.ApiError.badRequest('DESCRIPTION_TOO_SHORT', 'History description must be at least 5 characters');
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
        const isDisciplinary = dto.type === client_1.EmployeeHistoryType.WARNING;
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `Employee History: ${dto.type}`,
            action: isDisciplinary ? shared_1.AuditAction.DISCIPLINARY : shared_1.AuditAction.HISTORY_RECORDED,
            after: { historyId: record.id, type: dto.type, description: dto.description },
        });
        return record;
    }
    async assignStaff(actor, employeeId, staffEmployeeId) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only Founder and Manager can assign staff');
        }
        const [target, staff] = await Promise.all([
            this.prisma.employee.findUnique({ where: { id: employeeId } }),
            this.prisma.employee.findUnique({ where: { id: staffEmployeeId }, include: { role: true } }),
        ]);
        if (!target)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (!staff)
            throw api_error_1.ApiError.notFound('STAFF_NOT_FOUND', 'Staff employee not found');
        if (staff.role.code !== 'STAFF') {
            throw api_error_1.ApiError.badRequest('INVALID_ROLE', 'Assigned employee must have STAFF role');
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
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only Founder and Manager can unassign staff');
        }
        await this.prisma.employeeAssignment.deleteMany({
            where: { staffEmployeeId, assignedEmployeeId: employeeId },
        });
        return { success: true };
    }
    async listAssignments(actor, employeeId) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        await this.assertCanAccessEmployee(actor, emp.id, emp.role.code);
        return this.prisma.employeeAssignment.findMany({
            where: { assignedEmployeeId: employeeId },
            include: { staffEmployee: { select: { id: true, fullName: true, email: true } } },
        });
    }
    async setActive(actor, id, active) {
        if (actor.roleCode !== 'FOUNDER') {
            throw api_error_1.ApiError.forbidden('FOUNDER_ONLY', 'Only the founder can activate or deactivate employees (PRD §5.1.2)');
        }
        const existing = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!existing)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (existing.role?.code === 'FOUNDER' && !active) {
            throw api_error_1.ApiError.forbidden('FOUNDER_PROTECTED', 'Cannot deactivate the Founder account');
        }
        if (!active && existing.id === actor.id) {
            throw api_error_1.ApiError.badRequest('SELF_DEACTIVATION', 'You cannot deactivate your own account');
        }
        const employee = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.employee.update({
                where: { id },
                data: { status: active ? client_1.EmployeeStatus.ACTIVE : client_1.EmployeeStatus.INACTIVE },
                select: EMPLOYEE_SELECT,
            });
            if (!active) {
                await tx.authSession.updateMany({ where: { employeeId: id }, data: { revokedAt: new Date() } });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: existing.email,
                action: active ? shared_1.AuditAction.ACTIVATED : shared_1.AuditAction.DEACTIVATED,
                after: { status: active ? client_1.EmployeeStatus.ACTIVE : client_1.EmployeeStatus.INACTIVE },
            });
            return updated;
        });
        return employee;
    }
    async resetPassword(actor, id, dto) {
        if (actor.roleCode !== 'FOUNDER') {
            throw api_error_1.ApiError.forbidden('FOUNDER_ONLY', 'Only the founder can reset employee passwords (PRD §5.1.2)');
        }
        const existing = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: { role: true },
        });
        if (!existing)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (existing.role?.code === 'FOUNDER') {
            throw api_error_1.ApiError.forbidden('FOUNDER_PROTECTED', 'Cannot reset Founder password');
        }
        const generated = dto.newPassword ? undefined : generateTemporaryPassword();
        const passwordHash = await (0, password_util_1.hashPassword)(dto.newPassword ?? generated);
        await this.prisma.$transaction(async (tx) => {
            await tx.employee.update({ where: { id }, data: { passwordHash } });
            await tx.authSession.updateMany({ where: { employeeId: id }, data: { revokedAt: new Date() } });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: id,
                entityLabel: existing.email,
                action: shared_1.AuditAction.PASSWORD_CHANGED,
                meta: { by: 'admin_reset' },
            });
        });
        return generated ? { temporaryPassword: generated } : {};
    }
    async assertCanAccessEmployee(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return;
        if (actor.roleCode === 'FOUNDER')
            return;
        if (actor.roleCode === 'MANAGER') {
            if (!(0, shared_1.outranks)(actor.roleCode, targetRoleCode)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only access employees strictly below your rank (PRD §5.1.2)');
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
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You do not have access to this employee');
            }
            return;
        }
        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You do not have access to this employee');
    }
    canAccessFinancials(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return true;
        if (actor.roleCode === 'FOUNDER')
            return true;
        if (actor.roleCode === 'MANAGER' && (0, shared_1.outranks)(actor.roleCode, targetRoleCode))
            return true;
        return false;
    }
    canAccessPerformance(actor, targetId, targetRoleCode) {
        if (actor.id === targetId)
            return true;
        if (actor.roleCode === 'FOUNDER')
            return true;
        if (actor.roleCode === 'MANAGER' && (0, shared_1.outranks)(actor.roleCode, targetRoleCode))
            return true;
        return false;
    }
    async assertEmailAvailable(email) {
        const found = await this.prisma.employee.findUnique({ where: { email } });
        if (found)
            throw api_error_1.ApiError.conflict('EMPLOYEE_EMAIL_EXISTS', 'An employee with this email already exists');
    }
    async requireRole(roleId) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            throw api_error_1.ApiError.badRequest('ROLE_NOT_FOUND', 'Role does not exist');
        return role;
    }
    assertRoleAssignmentAllowed(actor, targetRoleCode) {
        if (actor.roleCode === 'FOUNDER')
            return;
        if (targetRoleCode === 'FOUNDER') {
            throw api_error_1.ApiError.forbidden('ROLE_ASSIGNMENT_FORBIDDEN', 'Only founders may assign the founder role (PRD §5.1.2)');
        }
        if (!(0, shared_1.outranks)(actor.roleCode, targetRoleCode)) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only assign roles strictly below your rank (PRD §5.1.2)');
        }
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmployeesService);
function generateTemporaryPassword() {
    return (0, node_crypto_1.randomBytes)(9).toString('base64url');
}
//# sourceMappingURL=employees.service.js.map