import { Injectable } from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType, ROLE_CODES } from '@grotec/shared';
import { toPage, type PageParams } from '../../common/utils/pagination';
import { hashPassword } from '../auth/password.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const EMPLOYEE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(pagination: PageParams, filters: { q?: string; status?: EmployeeStatus; roleCode?: string }) {
    const where: Prisma.EmployeeWhereInput = { deletedAt: null };
    if (filters.q) {
      where.OR = [
        { fullName: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (filters.status) where.status = filters.status;
    if (filters.roleCode) where.role = { code: filters.roleCode };

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
    return toPage(items, total, pagination);
  }

  async get(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: EMPLOYEE_SELECT,
    });
    if (!employee) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
    return employee;
  }

  async create(actor: AuthEmployee, dto: CreateEmployeeDto) {
    const email = dto.email.trim().toLowerCase();
    await this.assertEmailAvailable(email);
    const role = await this.requireRole(dto.roleId);
    this.assertRoleAssignmentAllowed(actor, role.code);

    const temporaryPassword = dto.password ? undefined : generateTemporaryPassword();
    const passwordHash = await hashPassword(dto.password ?? (temporaryPassword as string));
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
        entityType: AuditEntityType.EMPLOYEE,
        entityId: employee.id,
        entityLabel: employee.email,
        action: AuditAction.CREATED,
        after: { email, fullName: dto.fullName, roleCode: role.code },
      });
      return employee;
    });

    return { employee: created, temporaryPassword };
  }

  async update(actor: AuthEmployee, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== existing.email) await this.assertEmailAvailable(email);
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
        entityType: AuditEntityType.EMPLOYEE,
        entityId: employee.id,
        entityLabel: employee.email,
        action: AuditAction.UPDATED,
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

  async setActive(actor: AuthEmployee, id: string, active: boolean) {
    const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
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

  async resetPassword(actor: AuthEmployee, id: string, dto: ResetPasswordDto) {
    const existing = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

    const generated = dto.newPassword ? undefined : generateTemporaryPassword();
    const passwordHash = await hashPassword(dto.newPassword ?? (generated as string));

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

  // -------------------------------------------------------------------------

  private async assertEmailAvailable(email: string): Promise<void> {
    const found = await this.prisma.employee.findUnique({ where: { email } });
    if (found) throw ApiError.conflict('EMPLOYEE_EMAIL_EXISTS', 'An employee with this email already exists');
  }

  private async requireRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw ApiError.badRequest('ROLE_NOT_FOUND', 'Role does not exist');
    return role;
  }

  /** Founder-role assignment is restricted to the founder (provisional rule). */
  private assertRoleAssignmentAllowed(actor: AuthEmployee, targetRoleCode: string): void {
    if (targetRoleCode === ROLE_CODES[0] /* FOUNDER */ && actor.roleCode !== ROLE_CODES[0]) {
      throw ApiError.forbidden('ROLE_ASSIGNMENT_FORBIDDEN', 'Only the founder can assign the founder role');
    }
  }
}

function generateTemporaryPassword(): string {
  return randomBytes(9).toString('base64url');
}
