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
import { AuditAction, AuditEntityType, StockState } from '@grotec/shared';

let ProductionService = class ProductionService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async listBatches(query = {}) {
        const where = {};
        if (query.productId) where.productId = query.productId;
        if (query.status) where.status = query.status;

        return this.prisma.productionBatch.findMany({
            where,
            include: {
                product: { select: { id: true, name: true, sku: true, unit: true } },
                createdBy: { select: { id: true, fullName: true, employeeCode: true } },
            },
            orderBy: { mfgDate: 'desc' },
        });
    }

    async getBatchById(id) {
        const batch = await this.prisma.productionBatch.findUnique({
            where: { id },
            include: {
                product: true,
                createdBy: { select: { id: true, fullName: true, employeeCode: true } },
                inventoryStocks: true,
            },
        });
        if (!batch) {
            throw ApiError.notFound('BATCH_NOT_FOUND', `Batch ${id} not found`);
        }
        return batch;
    }

    async createBatch(actor, input) {
        const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
        if (!product) {
            throw ApiError.notFound('PRODUCT_NOT_FOUND', `Product ${input.productId} not found`);
        }

        const qty = Number(input.quantityProduced);
        if (!qty || qty <= 0) {
            throw ApiError.badRequest('INVALID_QUANTITY', 'Quantity produced must be positive');
        }

        const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const batchNumber = input.batchNumber || `BATCH-${dateStr}-${product.sku.slice(4, 10)}-${Math.floor(100 + Math.random() * 900)}`;

        const mfgDate = input.mfgDate ? new Date(input.mfgDate) : new Date();
        const expDate = input.expDate ? new Date(input.expDate) : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);

        return this.prisma.$transaction(async (tx) => {
            const batch = await tx.productionBatch.create({
                data: {
                    batchNumber,
                    productId: product.id,
                    mfgDate,
                    expDate,
                    quantityProduced: qty,
                    quantityRemaining: qty,
                    status: input.status || 'COMPLETED',
                    notes: input.notes || null,
                    createdById: actor.id,
                    tenantId: actor.tenantId || null,
                },
                include: { product: true },
            });

            // Add to AVAILABLE stock
            const stock = await tx.inventoryStock.upsert({
                where: {
                    productId_batchId_state_location: {
                        productId: product.id,
                        batchId: batch.id,
                        state: StockState.AVAILABLE,
                        location: 'CENTRAL_WAREHOUSE',
                    },
                },
                update: {
                    quantity: { increment: qty },
                },
                create: {
                    productId: product.id,
                    batchId: batch.id,
                    state: StockState.AVAILABLE,
                    location: 'CENTRAL_WAREHOUSE',
                    quantity: qty,
                    tenantId: actor.tenantId || null,
                },
            });

            // Record inventory movement
            await tx.inventoryMovement.create({
                data: {
                    stockId: stock.id,
                    productId: product.id,
                    fromState: null,
                    toState: StockState.AVAILABLE,
                    quantity: qty,
                    referenceType: 'PRODUCTION',
                    referenceId: batch.id,
                    actorId: actor.id,
                    notes: `Produced batch ${batch.batchNumber}`,
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.PRODUCTION_BATCH,
                entityId: batch.id,
                entityLabel: batch.batchNumber,
                action: AuditAction.BATCH_PRODUCED,
                after: { batchNumber, quantityProduced: qty, productId: product.id },
            });

            return batch;
        });
    }
};

ProductionService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], ProductionService);

export { ProductionService };
