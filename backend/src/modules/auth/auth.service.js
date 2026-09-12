var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d, _e;
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmployeeStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import { hashPassword, verifyPassword } from './password.util';
import { RateLimitService } from './rate-limit.service';
import { generateRefreshToken, hashRefreshToken } from './session.util';
let AuthService = class AuthService {
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
            throw ApiError.tooManyRequests();
        }
        const employee = await this.prisma.employee.findUnique({ where: { email: normalized } });
        const passwordOk = employee ? await verifyPassword(password, employee.passwordHash) : false;
        if (!employee || !passwordOk) {
            this.rateLimit.recordFailure(normalized, clientIp);
            await this.audit.recordDirect({
                actorId: employee?.id ?? null,
                entityType: AuditEntityType.AUTH,
                action: AuditAction.LOGIN_FAILED,
                entityLabel: normalized,
                meta: { ip: clientIp, reason: 'invalid_credentials' },
            });
            throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
        }
        if (employee.deletedAt !== null || employee.status !== EmployeeStatus.ACTIVE) {
            this.rateLimit.recordFailure(normalized, clientIp);
            await this.audit.recordDirect({
                actorId: employee.id,
                entityType: AuditEntityType.AUTH,
                action: AuditAction.LOGIN_FAILED,
                entityLabel: normalized,
                meta: { ip: clientIp, reason: 'inactive' },
            });
            throw ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
        }
        this.rateLimit.reset(normalized, clientIp);
        const { permissions, role } = await this.permissionsFor(employee.roleId);
        const session = await this.prisma.$transaction(async (tx) => {
            const refreshToken = generateRefreshToken();
            const created = await tx.authSession.create({
                data: {
                    employeeId: employee.id,
                    tokenHash: hashRefreshToken(refreshToken),
                    expiresAt: this.refreshExpiry(),
                    ip: clientIp,
                    userAgent: userAgent ?? null,
                },
            });
            await tx.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date() } });
            await this.audit.record(tx, {
                actorId: employee.id,
                entityType: AuditEntityType.AUTH,
                action: AuditAction.LOGIN_SUCCESS,
                entityId: created.id,
                entityLabel: normalized,
                meta: { ip: clientIp },
            });
            return { refreshToken, sessionId: created.id };
        });
        return {
            accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions, session.sessionId, employee.tenantId),
            accessTokenExpiresInSeconds: this.accessTtlSeconds(),
            newRefreshToken: session.refreshToken,
            employee: {
                id: employee.id,
                email: employee.email,
                fullName: employee.fullName,
                roleCode: role.code,
                permissions,
                tenantId: employee.tenantId,
            },
        };
    }
    async rotateSession(rawToken, ip, userAgent) {
        const tokenHash = hashRefreshToken(rawToken);
        // Atomic claim: only one concurrent caller can flip revoked_at from null to a
        // timestamp. findFirst → update is racy: two parallel requests can both see the
        // row as live and both issue new tokens.
        const claim = await this.prisma.authSession.updateMany({
            where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
            data: { revokedAt: new Date() },
        });
        if (claim.count === 0) {
            // Either the row does not exist, was already revoked, or has expired.
            // A previously-issued row with this hash exists → token reuse after rotation.
            // This is the canonical refresh-token-theft signal (OWASP ASVS V3 / Auth0
            // "refresh token reuse detection"). Revoke every active session for the
            // employee to invalidate any session the attacker may have created.
            const existing = await this.prisma.authSession.findFirst({ where: { tokenHash } });
            if (existing && existing.revokedAt !== null) {
                await this.prisma.authSession.updateMany({
                    where: { employeeId: existing.employeeId, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
                await this.audit.recordDirect({
                    actorId: existing.employeeId,
                    entityType: AuditEntityType.AUTH,
                    action: AuditAction.REFRESH_REUSED,
                    entityId: existing.id,
                    entityLabel: 'refresh-token-reuse-detected',
                });
            }
            throw ApiError.unauthorized('INVALID_REFRESH', 'Session expired, please sign in again');
        }
        // The single claimant row — we need the employeeId. updateMany doesn't return
        // rows, so a follow-up findFirst is safe (the row is now revoked, the
        // state we want).
        const claimed = await this.prisma.authSession.findFirstOrThrow({ where: { tokenHash } });
        // Idle-suspend check: the row is already revoked above (the claim step),
        // so an idle session simply never gets a replacement issued. lastUsedAt
        // is touched on every authenticated request the access token this
        // session minted is used on (see AuthGuard), throttled to roughly once
        // a minute, so this reflects real activity rather than just the
        // ~15-minute cadence a continuously-active session naturally refreshes at.
        const idleMs = Date.now() - claimed.lastUsedAt.getTime();
        if (idleMs > this.idleTimeoutSeconds() * 1000) {
            await this.audit.recordDirect({
                actorId: claimed.employeeId,
                entityType: AuditEntityType.AUTH,
                action: AuditAction.SESSION_IDLE_TIMEOUT,
                entityId: claimed.id,
                meta: { idleMs },
            });
            throw ApiError.unauthorized('SESSION_IDLE_TIMEOUT', 'Your session was signed out due to inactivity. Please sign in again.');
        }
        const employee = await this.prisma.employee.findUnique({ where: { id: claimed.employeeId } });
        if (!employee || employee.deletedAt !== null || employee.status !== EmployeeStatus.ACTIVE) {
            throw ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
        }
        const { permissions, role } = await this.permissionsFor(employee.roleId);
        const nextRefreshToken = generateRefreshToken();
        const nextSession = await this.prisma.authSession.create({
            data: {
                employeeId: employee.id,
                tokenHash: hashRefreshToken(nextRefreshToken),
                expiresAt: this.refreshExpiry(),
                ip: ip ?? claimed.ip,
                userAgent: userAgent ?? claimed.userAgent,
            },
        });
        return {
            accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions, nextSession.id, employee.tenantId),
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
        const tokenHash = hashRefreshToken(rawToken);
        // Atomic claim prevents a racy findFirst → update from skipping a concurrent logout.
        const claimed = await this.prisma.authSession.findFirst({
            where: { tokenHash, revokedAt: null },
        });
        const result = await this.prisma.authSession.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        if (result.count === 0)
            return;
        await this.audit.recordDirect({
            actorId: claimed?.employeeId ?? null,
            entityType: AuditEntityType.AUTH,
            action: AuditAction.LOGOUT,
            entityId: claimed?.id ?? null,
        });
    }
    async me(principal) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: principal.id },
            include: { role: true },
        });
        if (!employee || employee.deletedAt !== null || employee.status !== EmployeeStatus.ACTIVE) {
            throw ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
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
            throw ApiError.unauthorized();
        const ok = await verifyPassword(currentPassword, employee.passwordHash);
        if (!ok)
            throw ApiError.badRequest('INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
        const passwordHash = await hashPassword(newPassword);
        await this.prisma.$transaction(async (tx) => {
            await tx.employee.update({ where: { id: employee.id }, data: { passwordHash } });
            // Password change invalidates every refresh session; user signs in again.
            await tx.authSession.updateMany({ where: { employeeId: employee.id }, data: { revokedAt: new Date() } });
            await this.audit.record(tx, {
                actorId: employee.id,
                entityType: AuditEntityType.AUTH,
                action: AuditAction.PASSWORD_CHANGED,
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
            throw ApiError.unauthorized();
        return {
            role,
            permissions: role.rolePermissions.map((rp) => rp.permission.code),
        };
    }
    signAccessToken(employeeId, email, fullName, roleCode, permissions, sessionId, tenantId) {
        return this.jwt.sign({
            sub: employeeId,
            email,
            fullName,
            role: roleCode,
            permissions,
            sid: sessionId,
            tenantId: tenantId ?? null,
        });
    }
    accessTtlSeconds() {
        return Number(this.config.get('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
    }
    idleTimeoutSeconds() {
        return Number(this.config.get('SESSION_IDLE_TIMEOUT_SECONDS') ?? 900);
    }
    refreshExpiry() {
        const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
};
AuthService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof JwtService !== "undefined" && JwtService) === "function" ? _b : Object, typeof (_c = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _c : Object, typeof (_d = typeof RateLimitService !== "undefined" && RateLimitService) === "function" ? _d : Object, typeof (_e = typeof AuditService !== "undefined" && AuditService) === "function" ? _e : Object])
], AuthService);
export { AuthService };
