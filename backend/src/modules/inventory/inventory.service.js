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

let InventoryService = class InventoryService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async getStocks(query = {}) {
        const where = {};
        if (query.productId) where.productId = query.productId;
        if (query.state) where.state = query.state;
        if (query.location) where.location = query.location;

        const stocks = await this.prisma.inventoryStock.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        brand: true,
                        unit: true,
                        packageSize: true,
                        basePrice: true,
                        category: { select: { id: true, name: true, code: true } },
                    },
                },
                batch: {
                    select: { id: true, batchNumber: true, mfgDate: true, expDate: true },
                },
            },
            orderBy: [{ productId: 'asc' }, { state: 'asc' }],
        });

        // Compute summary metrics per product
        const summary = {};
        for (const s of stocks) {
            const pid = s.productId;
            if (!summary[pid]) {
                summary[pid] = {
                    product: s.product,
                    available: 0,
                    allocated: 0,
                    loaded: 0,
                    inVehicle: 0,
                    total: 0,
                };
            }
            const qty = Number(s.quantity);
            summary[pid].total += qty;
            if (s.state === StockState.AVAILABLE) summary[pid].available += qty;
            else if (s.state === StockState.ALLOCATED) summary[pid].allocated += qty;
            else if (s.state === StockState.LOADED) summary[pid].loaded += qty;
            else if (s.state === StockState.REMAINING_IN_VEHICLE) summary[pid].inVehicle += qty;
        }

        return {
            stocks,
            summary: Object.values(summary),
        };
    }

    async getMovements(query = {}) {
        const where = {};
        if (query.productId) where.productId = query.productId;
        if (query.referenceType) where.referenceType = query.referenceType;

        return this.prisma.inventoryMovement.findMany({
            where,
            include: {
                actor: { select: { id: true, fullName: true, employeeCode: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: query.limit ? Number(query.limit) : 50,
        });
    }

    async adjustStock(actor, input) {
        const { productId, batchId, state, quantity, reason } = input;
        const qty = Number(quantity);
        if (isNaN(qty) || qty === 0) {
            throw ApiError.badRequest('INVALID_QUANTITY', 'Adjustment quantity must be non-zero');
        }

        return this.prisma.$transaction(async (tx) => {
            const stock = await tx.inventoryStock.upsert({
                where: {
                    productId_batchId_state_location: {
                        productId,
                        batchId: batchId || null,
                        state,
                        location: input.location || 'CENTRAL_WAREHOUSE',
                    },
                },
                update: {
                    quantity: { increment: qty },
                },
                create: {
                    productId,
                    batchId: batchId || null,
                    state,
                    location: input.location || 'CENTRAL_WAREHOUSE',
                    quantity: Math.max(0, qty),
                    tenantId: actor.tenantId || null,
                },
            });

            await tx.inventoryMovement.create({
                data: {
                    stockId: stock.id,
                    productId,
                    fromState: state,
                    toState: state,
                    quantity: qty,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    referenceId: stock.id,
                    actorId: actor.id,
                    notes: reason || 'Manual stock adjustment',
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.INVENTORY_STOCK,
                entityId: stock.id,
                entityLabel: `Adjustment (${state})`,
                action: AuditAction.STOCK_ADJUSTED,
                after: { productId, delta: qty, newQty: stock.quantity, reason },
            });

            return stock;
        });
    }
};

InventoryService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], InventoryService);

export { InventoryService };
