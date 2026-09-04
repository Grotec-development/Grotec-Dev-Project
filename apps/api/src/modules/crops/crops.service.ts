import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '@grotec/shared';

const CROP_SELECT = {
  id: true,
  code: true,
  name: true,
  localName: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.CropSelect;

@Injectable()
export class CropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(includeInactive: boolean, actor: AuthEmployee) {
    // Only content managers may view the full catalog including inactive crops.
    const canManage = (actor.permissions as string[]).includes('crop.manage');
    const where = includeInactive && canManage ? {} : { isActive: true };
    return this.prisma.crop.findMany({ where, select: CROP_SELECT, orderBy: { name: 'asc' } });
  }

  async create(actor: AuthEmployee, input: { code: string; name: string; localName?: string }) {
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) {
      throw ApiError.badRequest('INVALID_CROP_CODE', 'Crop code must be 2–40 chars: letters, digits, underscores');
    }
    const existing = await this.prisma.crop.findUnique({ where: { code } });
    if (existing) throw ApiError.conflict('CROP_CODE_EXISTS', `Crop code ${code} already exists`);

    const created = await this.prisma.$transaction(async (tx) => {
      const crop = await tx.crop.create({
        data: {
          code,
          name: input.name,
          localName: input.localName ?? null,
          createdById: actor.id,
        },
        select: CROP_SELECT,
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.CROP,
        entityId: crop.id,
        entityLabel: code,
        action: AuditAction.CREATED,
        after: { code, name: input.name },
      });
      return crop;
    });
    return created;
  }

  async update(actor: AuthEmployee, id: string, input: { name?: string; localName?: string | null; isActive?: boolean }) {
    const crop = await this.prisma.crop.findUnique({ where: { id } });
    if (!crop) throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.crop.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          localName: input.localName === undefined ? undefined : input.localName,
          isActive: input.isActive ?? undefined,
        },
        select: CROP_SELECT,
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.CROP,
        entityId: id,
        entityLabel: crop.code,
        action: AuditAction.UPDATED,
        before: { name: crop.name, localName: crop.localName, isActive: crop.isActive },
        after: { name: result.name, localName: result.localName, isActive: result.isActive },
      });
      return result;
    });
    return updated;
  }
}
