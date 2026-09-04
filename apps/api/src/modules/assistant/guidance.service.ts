import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';

const GUIDANCE_SELECT = {
  id: true,
  cropId: true,
  crop: { select: { id: true, code: true, name: true } },
  problemKeywords: true,
  recommendedProducts: true,
  usageGuidance: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CropProductGuidanceSelect;

export interface GuidanceListQuery {
  includeInactive?: boolean;
  cropId?: string;
  q?: string;
}

function cleanList(value: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value ?? []) {
    const item = raw.trim().replace(/\s+/g, ' ').replace(/^,|,$/g, '');
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

@Injectable()
export class GuidanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: GuidanceListQuery, actor: AuthEmployee): Promise<unknown> {
    // View/search (assistant.use) sees only active rows — this is the Knowledge
    // Base browse surface for telecallers. Content managers (assistant.manage)
    // can additionally list retired rows via includeInactive.
    const canManage = actor.permissions.includes('assistant.manage');
    const includeInactive = canManage && query.includeInactive;
    const where: Prisma.CropProductGuidanceWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(query.cropId ? { cropId: query.cropId } : {}),
      ...(query.q
        ? {
            OR: [
              { crop: { name: { contains: query.q, mode: 'insensitive' } } },
              { problemKeywords: { has: query.q } },
              { recommendedProducts: { has: query.q } },
            ],
          }
        : {}),
    };
    return this.prisma.cropProductGuidance.findMany({
      where,
      select: GUIDANCE_SELECT,
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async create(actor: AuthEmployee, input: { cropId: string; problemKeywords: string[]; recommendedProducts: string[]; usageGuidance?: string; notes?: string; isActive?: boolean }) {
    const crop = await this.prisma.crop.findUnique({ where: { id: input.cropId } });
    if (!crop) throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');

    const problemKeywords = cleanList(input.problemKeywords);
    const recommendedProducts = cleanList(input.recommendedProducts);
    if (problemKeywords.length === 0) throw ApiError.badRequest('INVALID_KEYWORDS', 'At least one problem keyword is required');
    if (recommendedProducts.length === 0) throw ApiError.badRequest('INVALID_PRODUCTS', 'At least one recommended product is required');

    const created = await this.prisma.$transaction(async (tx) => {
      const guidance = await tx.cropProductGuidance.create({
        data: {
          cropId: crop.id,
          problemKeywords,
          recommendedProducts,
          usageGuidance: input.usageGuidance?.trim() || null,
          notes: input.notes?.trim() || null,
          isActive: input.isActive ?? true,
          createdById: actor.id,
        },
        select: GUIDANCE_SELECT,
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.CROP_PRODUCT_GUIDANCE,
        entityId: guidance.id,
        entityLabel: `${crop.name} / ${problemKeywords.join(', ')}`,
        action: AuditAction.CREATED,
        after: { cropId: crop.id, problemKeywords, recommendedProducts },
      });
      return guidance;
    });
    return created;
  }

  async update(actor: AuthEmployee, id: string, input: { cropId?: string; problemKeywords?: string[]; recommendedProducts?: string[]; usageGuidance?: string | null; notes?: string | null; isActive?: boolean }) {
    const existing = await this.prisma.cropProductGuidance.findUnique({ where: { id }, include: { crop: { select: { name: true } } } });
    if (!existing) throw ApiError.notFound('GUIDANCE_NOT_FOUND', 'Guidance record not found');

    if (input.cropId) {
      const crop = await this.prisma.crop.findUnique({ where: { id: input.cropId } });
      if (!crop) throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');
    }

    const problemKeywords = input.problemKeywords !== undefined ? cleanList(input.problemKeywords) : undefined;
    const recommendedProducts = input.recommendedProducts !== undefined ? cleanList(input.recommendedProducts) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cropProductGuidance.update({
        where: { id },
        data: {
          cropId: input.cropId,
          problemKeywords,
          recommendedProducts,
          usageGuidance: input.usageGuidance === undefined ? undefined : input.usageGuidance?.trim() || null,
          notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
          isActive: input.isActive,
        },
        select: GUIDANCE_SELECT,
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.CROP_PRODUCT_GUIDANCE,
        entityId: id,
        entityLabel: `${existing.crop.name} / ${(problemKeywords ?? existing.problemKeywords).join(', ')}`,
        action: AuditAction.UPDATED,
        before: {
          cropId: existing.cropId,
          problemKeywords: existing.problemKeywords,
          recommendedProducts: existing.recommendedProducts,
          isActive: existing.isActive,
        },
        after: {
          cropId: result.cropId,
          problemKeywords: result.problemKeywords,
          recommendedProducts: result.recommendedProducts,
          isActive: result.isActive,
        },
      });
      return result;
    });
    return updated;
  }
}
