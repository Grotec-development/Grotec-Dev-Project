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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const shared_1 = require("@grotec/shared");
const password_util_1 = require("./password.util");
const rate_limit_service_1 = require("./rate-limit.service");
const session_util_1 = require("./session.util");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    rateLimit;
    audit;
    constructor(prisma, jwt, config, rateLimit, audit) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.rateLimit = rateLimit;
        this.audit = audit;
    }
    async login(email, password, ip, userAgent) {
        const normalized = email.trim().toLowerCase();
        const clientIp = ip ?? 'unknown';
        if (this.rateLimit.isLimited(normalized, clientIp)) {
            throw api_error_1.ApiError.tooManyRequests();
        }
        const employee = await this.prisma.employee.findUnique({ where: { email: normalized } });
        const passwordOk = employee ? await (0, password_util_1.verifyPassword)(password, employee.passwordHash) : false;
        if (!employee || !passwordOk) {
            this.rateLimit.recordFailure(normalized, clientIp);
            await this.audit.recordDirect({
                actorId: employee?.id ?? null,
                entityType: shared_1.AuditEntityType.AUTH,
                action: shared_1.AuditAction.LOGIN_FAILED,
                entityLabel: normalized,
                meta: { ip: clientIp, reason: 'invalid_credentials' },
            });
            throw api_error_1.ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
        }
        if (employee.deletedAt !== null || employee.status !== client_1.EmployeeStatus.ACTIVE) {
            this.rateLimit.recordFailure(normalized, clientIp);
            await this.audit.recordDirect({
                actorId: employee.id,
                entityType: shared_1.AuditEntityType.AUTH,
                action: shared_1.AuditAction.LOGIN_FAILED,
                entityLabel: normalized,
                meta: { ip: clientIp, reason: 'inactive' },
            });
            throw api_error_1.ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
        }
        this.rateLimit.reset(normalized, clientIp);
        const { permissions, role } = await this.permissionsFor(employee.roleId);
        const session = await this.prisma.$transaction(async (tx) => {
            const refreshToken = (0, session_util_1.generateRefreshToken)();
            const created = await tx.authSession.create({
                data: {
                    employeeId: employee.id,
                    tokenHash: (0, session_util_1.hashRefreshToken)(refreshToken),
                    expiresAt: this.refreshExpiry(),
                    ip: clientIp,
                    userAgent: userAgent ?? null,
                },
            });
            await tx.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date() } });
            await this.audit.record(tx, {
                actorId: employee.id,
                entityType: shared_1.AuditEntityType.AUTH,
                action: shared_1.AuditAction.LOGIN_SUCCESS,
                entityId: created.id,
                entityLabel: normalized,
                meta: { ip: clientIp },
            });
            return { refreshToken, sessionId: created.id };
        });
        return {
            accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions),
            accessTokenExpiresInSeconds: this.accessTtlSeconds(),
            newRefreshToken: session.refreshToken,
            employee: {
                id: employee.id,
                email: employee.email,
                fullName: employee.fullName,
                roleCode: role.code,
                permissions,
            },
        };
    }
    async rotateSession(rawToken, ip, userAgent) {
        const tokenHash = (0, session_util_1.hashRefreshToken)(rawToken);
        const session = await this.prisma.authSession.findFirst({ where: { tokenHash } });
        if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
            if (session && session.revokedAt === null) {
                await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
            }
            throw api_error_1.ApiError.unauthorized('INVALID_REFRESH', 'Session expired, please sign in again');
        }
        const employee = await this.prisma.employee.findUnique({ where: { id: session.employeeId } });
        if (!employee || employee.deletedAt !== null || employee.status !== client_1.EmployeeStatus.ACTIVE) {
            throw api_error_1.ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
        }
        const { permissions, role } = await this.permissionsFor(employee.roleId);
        const nextRefreshToken = (0, session_util_1.generateRefreshToken)();
        await this.prisma.$transaction(async (tx) => {
            await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
            await tx.authSession.create({
                data: {
                    employeeId: employee.id,
                    tokenHash: (0, session_util_1.hashRefreshToken)(nextRefreshToken),
                    expiresAt: this.refreshExpiry(),
                    ip: ip ?? session.ip,
                    userAgent: userAgent ?? session.userAgent,
                },
            });
        });
        return {
            accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions),
            accessTokenExpiresInSeconds: this.accessTtlSeconds(),
            employee: {
                id: employee.id,
                email: employee.email,
                fullName: employee.fullName,
                roleCode: role.code,
                permissions,
            },
            newRefreshToken: nextRefreshToken,
        };
    }
    async logout(rawToken) {
        if (!rawToken)
            return;
        const session = await this.prisma.authSession.findFirst({
            where: { tokenHash: (0, session_util_1.hashRefreshToken)(rawToken), revokedAt: null },
        });
        if (!session)
            return;
        await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        await this.audit.recordDirect({
            actorId: session.employeeId,
            entityType: shared_1.AuditEntityType.AUTH,
            action: shared_1.AuditAction.LOGOUT,
            entityId: session.id,
        });
    }
    async me(principal) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: principal.id },
            include: { role: true },
        });
        if (!employee || employee.deletedAt !== null || employee.status !== client_1.EmployeeStatus.ACTIVE) {
            throw api_error_1.ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
        }
        const { permissions, role } = await this.permissionsFor(employee.roleId);
        return {
            id: employee.id,
            email: employee.email,
            fullName: employee.fullName,
            roleCode: role.code,
            permissions,
        };
    }
    async changePassword(principal, currentPassword, newPassword) {
        const employee = await this.prisma.employee.findUnique({ where: { id: principal.id } });
        if (!employee || employee.deletedAt !== null)
            throw api_error_1.ApiError.unauthorized();
        const ok = await (0, password_util_1.verifyPassword)(currentPassword, employee.passwordHash);
        if (!ok)
            throw api_error_1.ApiError.badRequest('INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
        const passwordHash = await (0, password_util_1.hashPassword)(newPassword);
        await this.prisma.$transaction(async (tx) => {
            await tx.employee.update({ where: { id: employee.id }, data: { passwordHash } });
            await tx.authSession.updateMany({ where: { employeeId: employee.id }, data: { revokedAt: new Date() } });
            await this.audit.record(tx, {
                actorId: employee.id,
                entityType: shared_1.AuditEntityType.AUTH,
                action: shared_1.AuditAction.PASSWORD_CHANGED,
                entityId: employee.id,
                entityLabel: employee.email,
            });
        });
    }
    async permissionsFor(roleId) {
        const role = await this.prisma.role.findUnique({
            where: { id: roleId },
            include: { rolePermissions: { include: { permission: true } } },
        });
        if (!role)
            throw api_error_1.ApiError.unauthorized();
        return {
            role,
            permissions: role.rolePermissions.map((rp) => rp.permission.code),
        };
    }
    signAccessToken(employeeId, email, fullName, roleCode, permissions) {
        return this.jwt.sign({
            sub: employeeId,
            email,
            fullName,
            role: roleCode,
            permissions,
        });
    }
    accessTtlSeconds() {
        return Number(this.config.get('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
    }
    refreshExpiry() {
        const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        rate_limit_service_1.RateLimitService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map