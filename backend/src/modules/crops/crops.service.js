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
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '@grotec/shared';
const CROP_SELECT = {
    id: true,
    code: true,
    name: true,
    localName: true,
    category: true,
    isActive: true,
    createdAt: true,
};
let CropsService = class CropsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(includeInactive, actor) {
        // Only content managers may view the full catalog including inactive crops.
        const canManage = actor.permissions.includes('crop.manage');
        const where = includeInactive && canManage ? {} : { isActive: true };
        return this.prisma.crop.findMany({ where, select: CROP_SELECT, orderBy: { name: 'asc' } });
    }
    async create(actor, input) {
        const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
        if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) {
            throw ApiError.badRequest('INVALID_CROP_CODE', 'Crop code must be 2–40 chars: letters, digits, underscores');
        }
        const existing = await this.prisma.crop.findUnique({ where: { code } });
        if (existing)
            throw ApiError.conflict('CROP_CODE_EXISTS', `Crop code ${code} already exists`);
        const created = await this.prisma.$transaction(async (tx) => {
            const crop = await tx.crop.create({
                data: {
                    code,
                    name: input.name,
                    localName: input.localName ?? null,
                    category: input.category ?? null,
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
                after: { code, name: input.name, category: input.category ?? null },
            });
            return crop;
        });
        return created;
    }
    async update(actor, id, input) {
        const crop = await this.prisma.crop.findUnique({ where: { id } });
        if (!crop)
            throw ApiError.notFound('CROP_NOT_FOUND', 'Crop not found');
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.crop.update({
                where: { id },
                data: {
                    name: input.name ?? undefined,
                    localName: input.localName === undefined ? undefined : input.localName,
                    category: input.category === undefined ? undefined : input.category,
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
                before: { name: crop.name, localName: crop.localName, category: crop.category, isActive: crop.isActive },
                after: { name: result.name, localName: result.localName, category: result.category, isActive: result.isActive },
            });
            return result;
        });
        return updated;
    }
};
CropsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], CropsService);
export { CropsService };
