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
import { AuditAction, AuditEntityType } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
const GUIDANCE_SELECT = {
    id: true,
    cropId: true,
    crop: { select: { id: true, code: true, name: true, category: true } },
    problemType: true,
    problemKeywords: true,
    recommendedProducts: true,
    usageGuidance: true,
    notes: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
function cleanList(value) {
    const seen = new Set();
    const out = [];
    for (const raw of value ?? []) {
        const item = raw.trim().replace(/\s+/g, ' ').replace(/^,|,$/g, '');
        if (!item || seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}
let GuidanceService = class GuidanceService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(query, actor) {
        // View/search (assistant.use) sees only active rows — this is the Knowledge
        // Base browse surface for telecallers. Content managers (assistant.manage)
        // can additionally list retired rows via includeInactive.
        const canManage = actor.permissions.includes('assistant.manage');
        const includeInactive = canManage && query.includeInactive;
        const where = {
            ...(includeInactive ? {} : { isActive: true }),
            ...(query.cropId ? { cropId: query.cropId } : {}),
            ...(query.problemType ? { problemType: query.problemType } : {}),
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
    async create(actor, input) {
        const crop = await this.prisma.crop.findUnique({ where: { id: input.cropId } });
        if (!crop)
            throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');
        const problemKeywords = cleanList(input.problemKeywords);
        const recommendedProducts = cleanList(input.recommendedProducts);
        if (problemKeywords.length === 0)
            throw ApiError.badRequest('INVALID_KEYWORDS', 'At least one problem keyword is required');
        if (recommendedProducts.length === 0)
            throw ApiError.badRequest('INVALID_PRODUCTS', 'At least one recommended product is required');
        const created = await this.prisma.$transaction(async (tx) => {
            const guidance = await tx.cropProductGuidance.create({
                data: {
                    cropId: crop.id,
                    problemType: input.problemType ?? null,
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
                after: { cropId: crop.id, problemType: guidance.problemType, problemKeywords, recommendedProducts },
            });
            return guidance;
        });
        return created;
    }
    async update(actor, id, input) {
        const existing = await this.prisma.cropProductGuidance.findUnique({ where: { id }, include: { crop: { select: { name: true } } } });
        if (!existing)
            throw ApiError.notFound('GUIDANCE_NOT_FOUND', 'Guidance record not found');
        if (input.cropId) {
            const crop = await this.prisma.crop.findUnique({ where: { id: input.cropId } });
            if (!crop)
                throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');
        }
        const problemKeywords = input.problemKeywords !== undefined ? cleanList(input.problemKeywords) : undefined;
        const recommendedProducts = input.recommendedProducts !== undefined ? cleanList(input.recommendedProducts) : undefined;
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.cropProductGuidance.update({
                where: { id },
                data: {
                    cropId: input.cropId,
                    problemType: input.problemType === undefined ? undefined : input.problemType,
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
                    problemType: existing.problemType,
                    problemKeywords: existing.problemKeywords,
                    recommendedProducts: existing.recommendedProducts,
                    isActive: existing.isActive,
                },
                after: {
                    cropId: result.cropId,
                    problemType: result.problemType,
                    problemKeywords: result.problemKeywords,
                    recommendedProducts: result.recommendedProducts,
                    isActive: result.isActive,
                },
            });
            return result;
        });
        return updated;
    }
};
GuidanceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], GuidanceService);
export { GuidanceService };
