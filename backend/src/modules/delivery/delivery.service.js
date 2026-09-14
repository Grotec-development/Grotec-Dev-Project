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
import { AuditAction, AuditEntityType, DeliveryStatus, StockState, TripStatus } from '@grotec/shared';

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
            // Update delivered quantities on order items and deduct from vehicle stocks
            for (const item of stop.order.items) {
                const delQty = input.deliveredItems?.find(d => d.orderItemId === item.id)?.deliveredQty ?? item.approvedQty;
                const finalDelQty = Number(delQty);

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

            // Mark stop COMPLETED with Proof of Delivery (POD)
            const completedStop = await tx.tripStop.update({
                where: { id: stopId },
                data: {
                    status: DeliveryStatus.COMPLETED,
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

            // Mark order DELIVERED and update payment if specified
            await tx.salesOrder.update({
                where: { id: stop.orderId },
                data: {
                    status: 'DELIVERED',
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
