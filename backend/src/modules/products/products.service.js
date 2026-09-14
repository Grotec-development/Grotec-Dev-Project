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

let ProductsService = class ProductsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async listCategories() {
        return this.prisma.productCategory.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }

    async list(query = {}) {
        const where = { deletedAt: null };
        if (query.categoryId) {
            where.categoryId = query.categoryId;
        }
        if (query.isActive !== undefined) {
            where.isActive = query.isActive === 'true' || query.isActive === true;
        }
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
                { brand: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.product.findMany({
            where,
            include: {
                category: { select: { id: true, name: true, code: true } },
                inventory: {
                    select: { state: true, quantity: true, location: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    async getById(id) {
        const product = await this.prisma.product.findFirst({
            where: { id, deletedAt: null },
            include: {
                category: true,
                batches: {
                    where: { quantityRemaining: { gt: 0 } },
                    orderBy: { mfgDate: 'desc' },
                },
                inventory: true,
            },
        });
        if (!product) {
            throw ApiError.notFound('PRODUCT_NOT_FOUND', `Product ${id} not found`);
        }
        return product;
    }

    async create(actor, input) {
        const sku = input.sku?.trim().toUpperCase();
        if (!sku) {
            throw ApiError.badRequest('SKU_REQUIRED', 'Product SKU is required');
        }

        const existing = await this.prisma.product.findUnique({ where: { sku } });
        if (existing) {
            throw ApiError.conflict('SKU_EXISTS', `Product with SKU ${sku} already exists`);
        }

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    sku,
                    name: input.name,
                    brand: input.brand || 'Grotec',
                    description: input.description || null,
                    categoryId: input.categoryId || null,
                    hsnCode: input.hsnCode || '31010099',
                    unit: input.unit || 'LTR',
                    packageSize: input.packageSize ?? 1.0,
                    basePrice: input.basePrice,
                    gstRate: input.gstRate ?? 5.0,
                    isActive: input.isActive ?? true,
                    tenantId: actor.tenantId || null,
                },
                include: { category: true },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.PRODUCT,
                entityId: product.id,
                entityLabel: product.name,
                action: AuditAction.CREATED,
                after: { sku: product.sku, name: product.name, basePrice: product.basePrice },
            });

            return product;
        });
    }

    async update(actor, id, input) {
        await this.getById(id);

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { id },
                data: {
                    name: input.name,
                    brand: input.brand,
                    description: input.description,
                    categoryId: input.categoryId,
                    unit: input.unit,
                    packageSize: input.packageSize,
                    basePrice: input.basePrice,
                    gstRate: input.gstRate,
                    isActive: input.isActive,
                },
                include: { category: true },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.PRODUCT,
                entityId: updated.id,
                entityLabel: updated.name,
                action: AuditAction.UPDATED,
                after: input,
            });

            return updated;
        });
    }
};

ProductsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], ProductsService);

export { ProductsService };
