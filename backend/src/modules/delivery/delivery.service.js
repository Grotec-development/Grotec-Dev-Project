var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { AuditAction, AuditEntityType, DeliveryStatus, StockState, TripStatus, isTopTier } from '@grotec/shared';

let DeliveryService = class DeliveryService {
    constructor(prisma, audit, customers, leads) {
        this.prisma = prisma;
        this.audit = audit;
        this.customers = customers;
        this.leads = leads;
    }

    async getActiveTripForDriver(actor) {
        const trip = await this.prisma.trip.findFirst({
            where: {
                driverId: actor.id,
                status: { in: [TripStatus.LOADED, TripStatus.IN_TRANSIT, TripStatus.DELIVERING, TripStatus.RECONCILIATION] },
            },
            include: {
                vehicle: true,
                stops: {
                    include: {
                        order: {
                            include: {
                                customer: {
                                    include: { phones: true, locations: true, crops: { include: { crop: true } } },
                                },
                                items: { include: { product: true } },
                                invoice: true,
                            },
                        },
                        quantityExceptions: true,
                    },
                    orderBy: { sequence: 'asc' },
                },
                vehicleStocks: { include: { product: true } },
            },
        });

        return trip || null;
    }

    async updateStopStatus(actor, stopId, input) {
        const stop = await this.prisma.tripStop.findUnique({
            where: { id: stopId },
            include: { trip: true },
        });
        if (!stop) throw ApiError.notFound('STOP_NOT_FOUND', 'Trip stop not found');

        const data = { status: input.status };
        if (input.status === DeliveryStatus.ARRIVED) {
            data.arrivedAt = new Date();
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.tripStop.update({
                where: { id: stopId },
                data,
            });

            // Update trip to DELIVERING if it was IN_TRANSIT
            if (stop.trip.status === TripStatus.IN_TRANSIT) {
                await tx.trip.update({
                    where: { id: stop.tripId },
                    data: { status: TripStatus.DELIVERING },
                });
            }

            return updated;
        });
    }

    async completeDelivery(actor, stopId, input) {
        const stop = await this.prisma.tripStop.findUnique({
            where: { id: stopId },
            include: {
                trip: { include: { vehicleStocks: true } },
                order: { include: { items: true } },
            },
        });
        if (!stop) throw ApiError.notFound('STOP_NOT_FOUND', 'Trip stop not found');

        return this.prisma.$transaction(async (tx) => {
            let isPartiallyDelivered = false;
            // Update delivered quantities on order items and deduct from vehicle stocks
            for (const item of stop.order.items) {
                const delQty = input.deliveredItems?.find(d => d.orderItemId === item.id)?.deliveredQty ?? item.approvedQty;
                const finalDelQty = Number(delQty);

                if (finalDelQty < Number(item.approvedQty)) {
                    isPartiallyDelivered = true;
                }

                await tx.salesOrderItem.update({
                    where: { id: item.id },
                    data: { deliveredQty: finalDelQty },
                });

                // Update VehicleStock deliveredQty
                await tx.vehicleStock.updateMany({
                    where: {
                        tripId: stop.tripId,
                        productId: item.productId,
                    },
                    data: {
                        deliveredQty: { increment: finalDelQty },
                    },
                });

                // Record movement to DELIVERED
                await tx.inventoryMovement.create({
                    data: {
                        productId: item.productId,
                        fromState: StockState.LOADED,
                        toState: StockState.DELIVERED,
                        quantity: finalDelQty,
                        referenceType: 'CUSTOMER_DELIVERY',
                        referenceId: stop.orderId,
                        actorId: actor.id,
                        notes: `Delivered to customer for stop ${stop.sequence}`,
                    },
                });
            }

            // Mark stop COMPLETED or PARTIAL_DELIVERY with Proof of Delivery (POD)
            const completedStop = await tx.tripStop.update({
                where: { id: stopId },
                data: {
                    status: isPartiallyDelivered ? DeliveryStatus.PARTIAL_DELIVERY : DeliveryStatus.COMPLETED,
                    completedAt: new Date(),
                    recipientName: input.recipientName || null,
                    recipientPhone: input.recipientPhone || null,
                    signatureUrl: input.signatureUrl || null,
                    photoUrl: input.photoUrl || null,
                    podNotes: input.podNotes || null,
                    gpsLatitude: input.gpsLatitude ? Number(input.gpsLatitude) : null,
                    gpsLongitude: input.gpsLongitude ? Number(input.gpsLongitude) : null,
                },
            });

            // Mark order PARTIALLY_DELIVERED or DELIVERED and update payment if specified
            const orderDeliveryStatus = isPartiallyDelivered ? 'PARTIALLY_DELIVERED' : 'DELIVERED';
            await tx.salesOrder.update({
                where: { id: stop.orderId },
                data: {
                    status: orderDeliveryStatus,
                    paymentStatus: input.paymentCollected ? 'PAID' : stop.order.paymentStatus,
                },
            });

            // Auto-advance next planned stop to EN_ROUTE if exists
            const nextStop = await tx.tripStop.findFirst({
                where: {
                    tripId: stop.tripId,
                    status: DeliveryStatus.PLANNED,
                },
                orderBy: { sequence: 'asc' },
            });

            if (nextStop) {
                await tx.tripStop.update({
                    where: { id: nextStop.id },
                    data: { status: DeliveryStatus.EN_ROUTE },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.TRIP_STOP,
                entityId: stop.id,
                entityLabel: `POD Stop #${stop.sequence}`,
                action: AuditAction.DELIVERY_COMPLETED,
                after: { recipientName: input.recipientName, completedAt: completedStop.completedAt },
            });

            return completedStop;
        });
    }

    async createFieldLead(actor, input) {
        // PRD §18.1 Field lead capture into Phase 1 CRM
        let customer = null;
        if (input.customerId) {
            customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
        } else if (input.phone) {
            const phoneMatch = await this.prisma.customerPhone.findFirst({
                where: { rawInput: input.phone },
                include: { customer: true },
            });
            if (phoneMatch) {
                customer = phoneMatch.customer;
            }
        }

        if (!customer) {
            // Create new customer on the field
            customer = await this.customers.create(actor, {
                fullName: input.fullName || 'Field Farmer Prospect',
                phone: input.phone,
                preferredLanguage: input.preferredLanguage || 'ta',
                soilType: input.soilType || 'Red Loam',
                location: {
                    village: input.village || null,
                    taluk: input.taluk || null,
                    district: input.district || null,
                    state: input.state || 'Tamil Nadu',
                },
            });
        }

        // Create lead in CRM
        const lead = await this.leads.create(actor, {
            customerId: customer.id,
            source: 'FIELD_DELIVERY',
            notes: input.notes ? `[Field Lead by ${actor.fullName}] ${input.notes}` : `Captured on field during delivery trip by ${actor.fullName}`,
        });

        return { customer, lead };
    }

    async recordPaymentCollection(actor, stopId, input) {
        const stop = await this.prisma.tripStop.findUnique({
            where: { id: stopId },
            include: {
                order: {
                    include: { customer: true, invoice: true },
                },
            },
        });
        if (!stop) throw ApiError.notFound('STOP_NOT_FOUND', 'Trip stop not found');

        const amount = Number(input.amount);
        if (!amount || amount <= 0) {
            throw ApiError.badRequest('INVALID_PAYMENT_AMOUNT', 'Collection amount must be greater than zero');
        }

        // Idempotency check: if client sent idempotencyKey and we already recorded it, return existing
        if (input.idempotencyKey) {
            const existing = await this.prisma.payment.findFirst({
                where: { referenceNumber: input.idempotencyKey },
                include: { order: { include: { customer: true } } },
            });
            if (existing) {
                return {
                    payment: existing,
                    slip: {
                        slipNumber: existing.paymentNumber,
                        orderNumber: existing.order.orderNumber,
                        customerName: existing.order.customer.fullName,
                        amount: Number(existing.amount),
                        status: existing.status,
                        collectedAt: existing.createdAt,
                        agentName: actor.fullName,
                        isApproved: existing.status === 'VERIFIED',
                    },
                };
            }
        }

        const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const paymentNumber = `COLL-${dateCode}-${Math.floor(1000 + Math.random() * 9000)}`;

        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    tenantId: actor.tenantId || null,
                    paymentNumber,
                    orderId: stop.orderId,
                    invoiceId: stop.order.invoice?.id || null,
                    amount,
                    paymentMethod: input.paymentMethod || 'CASH',
                    referenceNumber: input.idempotencyKey || input.referenceNumber || null,
                    status: 'PENDING_APPROVAL', // Auditable: not verified yet!
                    notes: input.notes ? `[Field Collection: ${actor.fullName}] ${input.notes}` : `Collected by ${actor.fullName} at stop #${stop.sequence}`,
                    createdById: actor.id,
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.PAYMENT,
                entityId: payment.id,
                entityLabel: payment.paymentNumber,
                action: 'payment.submitted_for_approval',
                after: { amount, method: payment.paymentMethod, orderNumber: stop.order.orderNumber },
            });

            const slip = {
                slipNumber: payment.paymentNumber,
                orderNumber: stop.order.orderNumber,
                customerName: stop.order.customer.fullName,
                amount,
                paymentMethod: payment.paymentMethod,
                balanceRemaining: Math.max(0, Number(stop.order.totalAmount) - (Number(stop.order.advancePaidAmount || 0) + amount)),
                status: 'PENDING_APPROVAL',
                collectedAt: payment.createdAt,
                agentName: actor.fullName,
                isApproved: false,
            };

            return { payment, slip };
        });
    }

    async listPendingPayments(actor) {
        return this.prisma.payment.findMany({
            where: {
                status: { in: ['PENDING_APPROVAL', 'PENDING_VERIFICATION'] },
            },
            include: {
                order: {
                    include: {
                        customer: { select: { id: true, fullName: true, farmerCode: true, phones: true } },
                        invoice: true,
                    },
                },
                createdBy: {
                    select: { id: true, fullName: true, employeeCode: true, role: { select: { code: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async reviewPayment(actor, paymentId, input) {
        const isAuthorizedReviewer =
            isTopTier(actor.roleCode) ||
            actor.roleCode === 'MANAGER' ||
            actor.permissions?.includes('orders.manage') ||
            actor.permissions?.includes('finance.manage');

        if (!isAuthorizedReviewer) {
            throw ApiError.forbidden('PAYMENT_REVIEW_FORBIDDEN', 'Only authorized managers can review payment collections');
        }

        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { order: { include: { invoice: true } } },
        });
        if (!payment) throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');

        // Prevent self-approval by delivery staff
        if (payment.createdById === actor.id && actor.roleCode === 'DELIVERY') {
            throw ApiError.forbidden('SELF_APPROVAL_FORBIDDEN', 'Delivery agents cannot approve their own payment submissions.');
        }

        const action = input.action; // 'APPROVE' | 'REJECT' | 'CLARIFICATION'
        if (action !== 'APPROVE' && action !== 'REJECT') {
            throw ApiError.badRequest('INVALID_ACTION', 'Action must be APPROVE or REJECT');
        }

        return this.prisma.$transaction(async (tx) => {
            if (action === 'APPROVE') {
                const updatedPayment = await tx.payment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'VERIFIED',
                        verifiedById: actor.id,
                        verifiedAt: new Date(),
                        notes: input.notes ? `${payment.notes || ''} [Approved: ${input.notes}]` : payment.notes,
                    },
                });

                // Update invoice and order balances
                const order = payment.order;
                const paymentAmt = Number(payment.amount);
                const newPaid = (order.advancePaidAmount || 0) + paymentAmt;
                const isFullyPaid = newPaid >= Number(order.totalAmount);

                await tx.salesOrder.update({
                    where: { id: order.id },
                    data: {
                        advancePaidAmount: newPaid,
                        paymentStatus: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
                    },
                });

                if (order.invoice) {
                    const currentInvPaid = (order.invoice.paidAmount || 0) + paymentAmt;
                    const newOutstanding = Math.max(0, Number(order.invoice.total) - currentInvPaid);
                    await tx.invoice.update({
                        where: { id: order.invoice.id },
                        data: {
                            paidAmount: currentInvPaid,
                            outstandingAmount: newOutstanding,
                            status: newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID',
                        },
                    });
                }

                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.PAYMENT,
                    entityId: paymentId,
                    entityLabel: payment.paymentNumber,
                    action: 'payment.approved',
                    after: { verifiedById: actor.id, notes: input.notes },
                });

                return updatedPayment;
            } else {
                const updatedPayment = await tx.payment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'REJECTED',
                        verifiedById: actor.id,
                        verifiedAt: new Date(),
                        notes: input.reason ? `[REJECTED: ${input.reason}] ${payment.notes || ''}` : payment.notes,
                    },
                });

                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.PAYMENT,
                    entityId: paymentId,
                    entityLabel: payment.paymentNumber,
                    action: 'payment.rejected',
                    after: { reason: input.reason },
                });

                return updatedPayment;
            }
        });
    }

    async recordCallOutcome(actor, stopId, input) {
        const stop = await this.prisma.tripStop.findUnique({
            where: { id: stopId },
            include: { order: true },
        });
        if (!stop) throw ApiError.notFound('STOP_NOT_FOUND', 'Trip stop not found');

        const validOutcomes = [
            'CONFIRMED',
            'CALL_BACK',
            'NO_ANSWER',
            'BUSY',
            'RESCHEDULED',
            'INVALID_NUMBER',
            'CUSTOMER_UNAVAILABLE',
        ];

        const outcome = input.outcome?.toUpperCase();
        if (!validOutcomes.includes(outcome)) {
            throw ApiError.badRequest('INVALID_OUTCOME', `Outcome must be one of: ${validOutcomes.join(', ')}`);
        }

        const data = {
            deliveryConfirmationStatus: outcome,
            confirmationNotes: input.notes ? `[Call by ${actor.fullName}] ${input.notes}` : `Call outcome recorded: ${outcome}`,
            confirmedAt: new Date(),
        };

        if (outcome === 'CONFIRMED' && input.confirmedDate) {
            data.confirmedDeliveryDate = new Date(input.confirmedDate);
        }
        if (outcome === 'RESCHEDULED' && input.rescheduledDate) {
            data.requestedDeliveryDate = new Date(input.rescheduledDate);
        }

        const updatedOrder = await this.prisma.salesOrder.update({
            where: { id: stop.orderId },
            data,
        });

        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: AuditEntityType.SALES_ORDER,
            entityId: stop.orderId,
            entityLabel: stop.order.orderNumber,
            action: 'delivery.customer_contacted',
            after: { outcome, notes: input.notes },
        });

        return { stop, order: updatedOrder };
    }
};

DeliveryService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [
        typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object,
        typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object,
        typeof (_c = typeof CustomersService !== "undefined" && CustomersService) === "function" ? _c : Object,
        typeof (_c = typeof LeadsService !== "undefined" && LeadsService) === "function" ? _c : Object
    ])
], DeliveryService);

export { DeliveryService };
