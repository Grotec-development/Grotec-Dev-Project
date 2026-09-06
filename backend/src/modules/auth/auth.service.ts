import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmployeeStatus, Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType, type PermissionCode, type RoleCode } from '@grotec/shared';
import { hashPassword, verifyPassword } from './password.util';
import { RateLimitService } from './rate-limit.service';
import { generateRefreshToken, hashRefreshToken } from './session.util';

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  newRefreshToken: string;
  employee: {
    id: string;
    email: string;
    fullName: string;
    roleCode: RoleCode;
    permissions: PermissionCode[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip: string | undefined, userAgent: string | undefined): Promise<LoginResult> {
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
      accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions),
      accessTokenExpiresInSeconds: this.accessTtlSeconds(),
      newRefreshToken: session.refreshToken,
      employee: {
        id: employee.id,
        email: employee.email,
        fullName: employee.fullName,
        roleCode: role.code as RoleCode,
        permissions,
      },
    };
  }

  async rotateSession(rawToken: string, ip: string | undefined, userAgent: string | undefined): Promise<LoginResult> {
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

    const employee = await this.prisma.employee.findUnique({ where: { id: claimed.employeeId } });
    if (!employee || employee.deletedAt !== null || employee.status !== EmployeeStatus.ACTIVE) {
      throw ApiError.unauthorized('ACCOUNT_INACTIVE', 'This account is inactive');
    }

    const { permissions, role } = await this.permissionsFor(employee.roleId);
    const nextRefreshToken = generateRefreshToken();
    await this.prisma.authSession.create({
      data: {
        employeeId: employee.id,
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: this.refreshExpiry(),
        ip: ip ?? claimed.ip,
        userAgent: userAgent ?? claimed.userAgent,
      },
    });

    return {
      accessToken: this.signAccessToken(employee.id, employee.email, employee.fullName, role.code, permissions),
      accessTokenExpiresInSeconds: this.accessTtlSeconds(),
      employee: {
        id: employee.id,
        email: employee.email,
        fullName: employee.fullName,
        roleCode: role.code as RoleCode,
        permissions,
      },
      newRefreshToken: nextRefreshToken,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    // Atomic claim prevents a racy findFirst → update from skipping a concurrent logout.
    const claimed = await this.prisma.authSession.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    const result = await this.prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) return;
    await this.audit.recordDirect({
      actorId: claimed?.employeeId ?? null,
      entityType: AuditEntityType.AUTH,
      action: AuditAction.LOGOUT,
      entityId: claimed?.id ?? null,
    });
  }

  async me(principal: AuthEmployee): Promise<LoginResult['employee']> {
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
      roleCode: role.code as RoleCode,
      permissions,
    };
  }

  async changePassword(principal: AuthEmployee, currentPassword: string, newPassword: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: principal.id } });
    if (!employee || employee.deletedAt !== null) throw ApiError.unauthorized();

    const ok = await verifyPassword(currentPassword, employee.passwordHash);
    if (!ok) throw ApiError.badRequest('INVALID_CURRENT_PASSWORD', 'Current password is incorrect');

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

  private async permissionsFor(roleId: string): Promise<{
    role: { code: string };
    permissions: PermissionCode[];
  }> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw ApiError.unauthorized();
    return {
      role,
      permissions: role.rolePermissions.map((rp) => rp.permission.code as PermissionCode),
    };
  }

  private signAccessToken(
    employeeId: string,
    email: string,
    fullName: string,
    roleCode: string,
    permissions: PermissionCode[],
  ): string {
    return this.jwt.sign({
      sub: employeeId,
      email,
      fullName,
      role: roleCode,
      permissions,
    });
  }

  private accessTtlSeconds(): number {
    return Number(this.config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
  }

  private refreshExpiry(): Date {
    const days = Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
