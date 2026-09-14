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
import { AuditAction, AuditEntityType, QuantityExceptionStatus, StockState } from '@grotec/shared';

let ExceptionsService = class ExceptionsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async requestQuantityException(actor, input) {
        const { tripId, stopId, orderItemId, requestedQty, reason, photoUrl } = input;
        const item = await this.prisma.salesOrderItem.findUnique({
            where: { id: orderItemId },
            include: { product: true, order: true },
        });
        if (!item) throw ApiError.notFound('ORDER_ITEM_NOT_FOUND', 'Sales order item not found');

        const reqQty = Number(requestedQty);
        if (isNaN(reqQty) || reqQty < 0) {
            throw ApiError.badRequest('INVALID_QUANTITY', 'Requested quantity must be non-negative');
        }

        return this.prisma.$transaction(async (tx) => {
            const exception = await tx.quantityException.create({
                data: {
                    tripId,
                    stopId,
                    orderItemId,
                    originalQty: item.originalQty,
                    requestedQty: reqQty,
                    reason: reason || 'Customer requested quantity modification on site',
                    photoUrl: photoUrl || null,
                    status: QuantityExceptionStatus.REQUESTED,
                },
                include: {
                    orderItem: { include: { product: true } },
                    trip: { select: { tripNumber: true } },
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.QUANTITY_EXCEPTION,
                entityId: exception.id,
                entityLabel: `Exception: ${item.product.name} (from ${item.originalQty} to ${reqQty})`,
                action: AuditAction.EXCEPTION_REQUESTED,
                after: { originalQty: item.originalQty, requestedQty: reqQty, reason },
            });

            return exception;
        });
    }

    async listPendingExceptions(actor) {
        return this.prisma.quantityException.findMany({
            where: {
                status: { in: [QuantityExceptionStatus.REQUESTED, QuantityExceptionStatus.UNDER_REVIEW] },
            },
            include: {
                trip: {
                    include: {
                        vehicle: true,
                        driver: { select: { id: true, fullName: true, phone: true } },
                    },
                },
                stop: {
                    include: {
                        order: {
                            include: {
                                customer: { select: { id: true, fullName: true, farmerCode: true } },
                            },
                        },
                    },
                },
                orderItem: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async reviewException(actor, exceptionId, input) {
        const exception = await this.prisma.quantityException.findUnique({
            where: { id: exceptionId },
            include: {
                orderItem: {
                    include: {
                        product: true,
                        order: {
                            include: {
                                items: true,
                                invoice: true,
                            },
                        },
                    },
                },
                trip: true,
            },
        });

        if (!exception) throw ApiError.notFound('EXCEPTION_NOT_FOUND', 'Quantity exception not found');
        if (exception.status !== QuantityExceptionStatus.REQUESTED && exception.status !== QuantityExceptionStatus.UNDER_REVIEW) {
            throw ApiError.badRequest('ALREADY_REVIEWED', `Exception already in ${exception.status} status`);
        }

        const isApprove = input.decision === 'APPROVE';
        const finalApprovedQty = isApprove ? (input.approvedQty !== undefined ? Number(input.approvedQty) : Number(exception.requestedQty)) : null;

        return this.prisma.$transaction(async (tx) => {
            if (!isApprove) {
                // Reject
                const rejected = await tx.quantityException.update({
                    where: { id: exceptionId },
                    data: {
                        status: QuantityExceptionStatus.REJECTED,
                        reviewedById: actor.id,
                        reviewNotes: input.reviewNotes || 'Manager rejected adjustment',
                        reviewedAt: new Date(),
                    },
                });

                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.QUANTITY_EXCEPTION,
                    entityId: exception.id,
                    entityLabel: `Rejected Qty Exception`,
                    action: AuditAction.EXCEPTION_REJECTED,
                    after: { exceptionId, decision: 'REJECT' },
                });

                return rejected;
            }

            // APPROVE - Execute PRD §18.2 rules:
            const item = exception.orderItem;
            const originalApproved = Number(item.approvedQty);
            const delta = finalApprovedQty - originalApproved; // Negative if decrease, positive if increase

            // Update item approvedQty and amount
            const unitPrice = Number(item.unitPrice);
            const taxRate = Number(item.taxRate);
            const discount = Number(item.discount);
            const taxable = Math.max(0, (unitPrice * finalApprovedQty) - discount);
            const taxAmount = (taxable * taxRate) / 100;
            const itemTotal = taxable + taxAmount;

            await tx.salesOrderItem.update({
                where: { id: item.id },
                data: {
                    approvedQty: finalApprovedQty,
                    taxAmount,
                    totalAmount: itemTotal,
                },
            });

            // If decrease: undelivered units return to vehicle's excess stock pool
            if (delta < 0) {
                const excessUnits = Math.abs(delta);
                await tx.vehicleStock.upsert({
                    where: {
                        tripId_productId: {
                            tripId: exception.tripId,
                            productId: item.productId,
                        },
                    },
                    update: {
                        excessQty: { increment: excessUnits },
                    },
                    create: {
                        tripId: exception.tripId,
                        productId: item.productId,
                        loadedQty: 0,
                        deliveredQty: 0,
                        excessQty: excessUnits,
                    },
                });
            } else if (delta > 0) {
                // If increase: deduct from vehicle stock excess pool if available
                await tx.vehicleStock.updateMany({
                    where: {
                        tripId: exception.tripId,
                        productId: item.productId,
                    },
                    data: {
                        excessQty: { decrement: delta },
                    },
                });
            }

            // Recalculate order and invoice totals
            const orderItems = await tx.salesOrderItem.findMany({ where: { orderId: item.orderId } });
            let newSubtotal = 0;
            let newTax = 0;
            for (const it of orderItems) {
                const itQty = it.id === item.id ? finalApprovedQty : Number(it.approvedQty);
                const itTaxable = Math.max(0, (Number(it.unitPrice) * itQty) - Number(it.discount));
                const itTax = (itTaxable * Number(it.taxRate)) / 100;
                newSubtotal += itTaxable;
                newTax += itTax;
            }
            const newTotal = newSubtotal + newTax;

            await tx.salesOrder.update({
                where: { id: item.orderId },
                data: {
                    subtotal: newSubtotal,
                    taxAmount: newTax,
                    totalAmount: newTotal,
                },
            });

            // Automatically revise Invoice
            const halfTax = newTax / 2;
            await tx.invoice.updateMany({
                where: { orderId: item.orderId },
                data: {
                    subtotal: newSubtotal,
                    cgst: halfTax,
                    sgst: halfTax,
                    total: newTotal,
                    isRevised: true,
                    status: 'REVISED',
                    revisionReason: `Revised per quantity exception: ${item.product.name} changed from ${originalApproved} to ${finalApprovedQty}`,
                },
            });

            const approved = await tx.quantityException.update({
                where: { id: exceptionId },
                data: {
                    status: QuantityExceptionStatus.APPROVED,
                    approvedQty: finalApprovedQty,
                    reviewedById: actor.id,
                    reviewNotes: input.reviewNotes || 'Approved by manager',
                    reviewedAt: new Date(),
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.QUANTITY_EXCEPTION,
                entityId: exception.id,
                entityLabel: `Approved Qty Exception (${item.product.name})`,
                action: AuditAction.EXCEPTION_APPROVED,
                after: { approvedQty: finalApprovedQty, revisedTotal: newTotal },
            });

            return approved;
        });
    }
};

ExceptionsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], ExceptionsService);

export { ExceptionsService };
