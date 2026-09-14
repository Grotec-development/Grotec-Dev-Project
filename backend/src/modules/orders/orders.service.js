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
import { AuditAction, AuditEntityType, OrderStatus, StockState } from '@grotec/shared';

let OrdersService = class OrdersService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async listOrders(actor, query = {}) {
        const where = { deletedAt: null };
        if (query.customerId) where.customerId = query.customerId;
        if (query.status) where.status = query.status;
        if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

        return this.prisma.salesOrder.findMany({
            where,
            include: {
                customer: { select: { id: true, fullName: true, farmerCode: true, phones: { where: { isPrimary: true }, select: { phoneE164: true } } } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, unit: true } },
                    },
                },
                invoice: true,
                createdBy: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getOrderById(actor, id) {
        const order = await this.prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: {
                    include: {
                        phones: true,
                        locations: true,
                    },
                },
                items: {
                    include: {
                        product: true,
                        quantityExceptions: true,
                    },
                },
                invoice: true,
                tripStops: {
                    include: {
                        trip: { select: { id: true, tripNumber: true, status: true, driver: { select: { fullName: true, phone: true } } } },
                    },
                },
                createdBy: { select: { id: true, fullName: true, employeeCode: true } },
            },
        });

        if (!order) {
            throw ApiError.notFound('ORDER_NOT_FOUND', `Sales order ${id} not found`);
        }
        return order;
    }

    async createOrder(actor, input) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: input.customerId },
            include: { locations: { where: { isPrimary: true } } },
        });
        if (!customer) {
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', `Customer ${input.customerId} not found`);
        }

        if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
            throw ApiError.badRequest('ITEMS_REQUIRED', 'At least one order item is required');
        }

        // Fetch products and compute items
        let subtotal = 0;
        let totalTax = 0;
        const processedItems = [];

        for (const item of input.items) {
            const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) {
                throw ApiError.notFound('PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
            }

            const qty = Number(item.quantity);
            if (!qty || qty <= 0) {
                throw ApiError.badRequest('INVALID_QUANTITY', `Quantity for ${product.name} must be positive`);
            }

            const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.basePrice);
            const discount = Number(item.discount || 0);
            const taxableAmount = Math.max(0, (unitPrice * qty) - discount);
            const taxRate = Number(product.gstRate || 5.0);
            const taxAmount = (taxableAmount * taxRate) / 100;
            const itemTotal = taxableAmount + taxAmount;

            subtotal += taxableAmount;
            totalTax += taxAmount;

            processedItems.push({
                productId: product.id,
                originalQty: qty,
                approvedQty: qty,
                deliveredQty: 0,
                unitPrice,
                taxRate,
                taxAmount,
                discount,
                totalAmount: itemTotal,
            });
        }

        const grandTotal = subtotal + totalTax;
        const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const orderNumber = `SO-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
        const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const deliveryAddress = input.deliveryAddress || customer.locations[0]?.addressLine || 'Farm address';

        return this.prisma.$transaction(async (tx) => {
            const order = await tx.salesOrder.create({
                data: {
                    orderNumber,
                    customerId: customer.id,
                    status: OrderStatus.CONFIRMED,
                    subtotal,
                    discountAmount: 0,
                    taxAmount: totalTax,
                    totalAmount: grandTotal,
                    paymentStatus: input.paymentStatus || 'UNPAID',
                    paymentMethod: input.paymentMethod || 'CASH_ON_DELIVERY',
                    deliveryAddress,
                    notes: input.notes || null,
                    createdById: actor.id,
                    tenantId: actor.tenantId || null,
                    items: {
                        create: processedItems,
                    },
                },
                include: { items: { include: { product: true } } },
            });

            // Create initial Invoice
            const halfTax = totalTax / 2;
            const invoice = await tx.invoice.create({
                data: {
                    orderId: order.id,
                    invoiceNumber,
                    subtotal,
                    cgst: halfTax,
                    sgst: halfTax,
                    igst: 0,
                    total: grandTotal,
                    status: 'ISSUED',
                    isRevised: false,
                },
            });

            // Allocate inventory stock
            for (const item of processedItems) {
                await tx.inventoryStock.upsert({
                    where: {
                        productId_batchId_state_location: {
                            productId: item.productId,
                            batchId: null,
                            state: StockState.ALLOCATED,
                            location: 'CENTRAL_WAREHOUSE',
                        },
                    },
                    update: { quantity: { increment: item.approvedQty } },
                    create: {
                        productId: item.productId,
                        batchId: null,
                        state: StockState.ALLOCATED,
                        location: 'CENTRAL_WAREHOUSE',
                        quantity: item.approvedQty,
                        tenantId: actor.tenantId || null,
                    },
                });

                await tx.inventoryMovement.create({
                    data: {
                        productId: item.productId,
                        fromState: StockState.AVAILABLE,
                        toState: StockState.ALLOCATED,
                        quantity: item.approvedQty,
                        referenceType: 'SALES_ORDER',
                        referenceId: order.id,
                        actorId: actor.id,
                        notes: `Allocated for order ${order.orderNumber}`,
                    },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: order.id,
                entityLabel: order.orderNumber,
                action: AuditAction.ORDER_PLACED,
                after: { orderNumber: order.orderNumber, totalAmount: order.totalAmount, customerId: customer.id },
            });

            return {
                ...order,
                invoice,
            };
        });
    }

    async updateOrderStatus(actor, id, status) {
        const order = await this.getOrderById(actor, id);

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.salesOrder.update({
                where: { id },
                data: { status },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: id,
                entityLabel: order.orderNumber,
                action: AuditAction.UPDATED,
                after: { previousStatus: order.status, status },
            });

            return updated;
        });
    }
};

OrdersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], OrdersService);

export { OrdersService };
