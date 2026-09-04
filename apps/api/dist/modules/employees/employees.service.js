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
const EMPLOYEE_SELECT = {
    id: true,
    email: true,
    fullName: true,
    phone: true,
    status: true,
    lastLoginAt: true,
    createdAt: true,
    role: { select: { id: true, code: true, name: true } },
};
let EmployeesService = class EmployeesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(pagination, filters) {
        const where = { deletedAt: null };
        if (filters.q) {
            where.OR = [
                { fullName: { contains: filters.q, mode: 'insensitive' } },
                { email: { contains: filters.q, mode: 'insensitive' } },
            ];
        }
        if (filters.status)
            where.status = filters.status;
        if (filters.roleCode)
            where.role = { code: filters.roleCode };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employee.findMany({
                where,
                select: EMPLOYEE_SELECT,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
            }),
            this.prisma.employee.count({ where }),
        ]);
        return (0, pagination_1.toPage)(items, total, pagination);
    }
    async get(id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            select: EMPLOYEE_SELECT,
        });
        if (!employee)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        return employee;
    }
    async create(actor, dto) {
        const email = dto.email.trim().toLowerCase();
        await this.assertEmailAvailable(email);
        const role = await this.requireRole(dto.roleId);
        this.assertRoleAssignmentAllowed(actor, role.code);
        const temporaryPassword = dto.password ? undefined : generateTemporaryPassword();
        const passwordHash = await (0, password_util_1.hashPassword)(dto.password ?? temporaryPassword);
        const created = await this.prisma.$transaction(async (tx) => {
            const employee = await tx.employee.create({
                data: {
                    email,
                    fullName: dto.fullName,
                    phone: dto.phone ?? null,
                    passwordHash,
                    roleId: role.id,
                    createdById: actor.id,
                },
                select: EMPLOYEE_SELECT,
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: employee.id,
                entityLabel: employee.email,
                action: shared_1.AuditAction.CREATED,
                after: { email, fullName: dto.fullName, roleCode: role.code },
            });
            return employee;
        });
        return { employee: created, temporaryPassword };
    }
    async update(actor, id, dto) {
        const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        const email = dto.email?.trim().toLowerCase();
        if (email && email !== existing.email)
            await this.assertEmailAvailable(email);
        let roleId = dto.roleId;
        if (dto.roleId && dto.roleId !== existing.roleId) {
            const role = await this.requireRole(dto.roleId);
            this.assertRoleAssignmentAllowed(actor, role.code);
            roleId = role.id;
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const employee = await tx.employee.update({
                where: { id },
                data: {
                    email: email ?? undefined,
                    fullName: dto.fullName ?? undefined,
                    phone: dto.phone === undefined ? undefined : dto.phone,
                    roleId,
                },
                select: EMPLOYEE_SELECT,
            });
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
                },
                after: { email, fullName: dto.fullName, phone: dto.phone, roleId },
            });
            return employee;
        });
        return updated;
    }
    async setActive(actor, id, active) {
        const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
        const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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
        if (targetRoleCode === shared_1.ROLE_CODES[0] && actor.roleCode !== shared_1.ROLE_CODES[0]) {
            throw api_error_1.ApiError.forbidden('ROLE_ASSIGNMENT_FORBIDDEN', 'Only the founder can assign the founder role');
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