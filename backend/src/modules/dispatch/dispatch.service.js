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
import { AuditAction, AuditEntityType, StockState, TripStatus, DeliveryStatus } from '@grotec/shared';

let DispatchService = class DispatchService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async listVehicles() {
        return this.prisma.vehicle.findMany({
            include: {
                driver: { select: { id: true, fullName: true, phone: true, employeeCode: true } },
            },
            orderBy: { regNumber: 'asc' },
        });
    }

    async createVehicle(actor, input) {
        const regNumber = input.regNumber?.trim().toUpperCase();
        if (!regNumber) {
            throw ApiError.badRequest('REG_NUMBER_REQUIRED', 'Vehicle registration number is required');
        }

        const existing = await this.prisma.vehicle.findUnique({ where: { regNumber } });
        if (existing) {
            throw ApiError.conflict('VEHICLE_EXISTS', `Vehicle ${regNumber} already exists`);
        }

        return this.prisma.vehicle.create({
            data: {
                regNumber,
                model: input.model || 'Standard Lorry',
                capacityKg: input.capacityKg ? Number(input.capacityKg) : 2500,
                driverId: input.driverId || null,
                status: 'AVAILABLE',
                tenantId: actor.tenantId || null,
            },
            include: { driver: true },
        });
    }

    async listTrips(actor, query = {}) {
        const where = {};
        if (query.status) where.status = query.status;
        if (query.driverId) where.driverId = query.driverId;

        return this.prisma.trip.findMany({
            where,
            include: {
                vehicle: true,
                driver: { select: { id: true, fullName: true, phone: true, employeeCode: true } },
                stops: {
                    include: {
                        order: {
                            include: {
                                customer: { select: { id: true, fullName: true, farmerCode: true } },
                            },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
                vehicleStocks: { include: { product: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getTripById(id) {
        const trip = await this.prisma.trip.findUnique({
            where: { id },
            include: {
                vehicle: true,
                driver: { select: { id: true, fullName: true, phone: true, employeeCode: true } },
                stops: {
                    include: {
                        order: {
                            include: {
                                customer: {
                                    include: { phones: true, locations: true },
                                },
                                items: { include: { product: true } },
                                invoice: true,
                            },
                        },
                        quantityExceptions: true,
                    },
                    orderBy: { sequence: 'asc' },
                },
                vehicleStocks: {
                    include: { product: true },
                },
                quantityExceptions: {
                    include: {
                        orderItem: { include: { product: true } },
                        reviewedBy: { select: { id: true, fullName: true } },
                    },
                },
            },
        });

        if (!trip) {
            throw ApiError.notFound('TRIP_NOT_FOUND', `Trip ${id} not found`);
        }
        return trip;
    }

    async createTrip(actor, input) {
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
        if (!vehicle) throw ApiError.notFound('VEHICLE_NOT_FOUND', 'Vehicle not found');

        const driver = await this.prisma.employee.findUnique({ where: { id: input.driverId } });
        if (!driver) throw ApiError.notFound('DRIVER_NOT_FOUND', 'Driver employee not found');

        if (!input.orderIds || !Array.isArray(input.orderIds) || input.orderIds.length === 0) {
            throw ApiError.badRequest('ORDERS_REQUIRED', 'At least one order must be attached to the trip');
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const tripNumber = `TRP-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

        return this.prisma.$transaction(async (tx) => {
            const trip = await tx.trip.create({
                data: {
                    tripNumber,
                    vehicleId: vehicle.id,
                    driverId: driver.id,
                    helperName: input.helperName || null,
                    status: TripStatus.PLANNED,
                    notes: input.notes || null,
                    createdById: actor.id,
                    tenantId: actor.tenantId || null,
                    stops: {
                        create: input.orderIds.map((orderId, idx) => ({
                            orderId,
                            sequence: idx + 1,
                            status: DeliveryStatus.PLANNED,
                        })),
                    },
                },
                include: {
                    stops: true,
                    vehicle: true,
                    driver: true,
                },
            });

            // Mark orders as DISPATCHED/IN_PROGRESS
            for (const orderId of input.orderIds) {
                await tx.salesOrder.update({
                    where: { id: orderId },
                    data: { status: 'DISPATCHED' },
                });
            }

            return trip;
        });
    }

    async verifyLoading(actor, tripId, checklist) {
        const trip = await this.getTripById(tripId);
        if (trip.status !== TripStatus.PLANNED && trip.status !== TripStatus.DRAFT) {
            throw ApiError.badRequest('INVALID_STATUS', `Trip in state ${trip.status} cannot be verified for loading`);
        }

        if (checklist.hasMismatch) {
            throw ApiError.badRequest('LOADING_MISMATCH', 'Loading mismatch blocks dispatch. Reconcile physical items before dispatch.');
        }

        // Calculate product quantities needed across all orders in this trip
        const productTotals = {};
        for (const stop of trip.stops) {
            for (const item of stop.order.items) {
                const pid = item.productId;
                const qty = Number(item.approvedQty);
                productTotals[pid] = (productTotals[pid] || 0) + qty;
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // Create VehicleStock entries for each product loaded
            for (const [productId, loadedQty] of Object.entries(productTotals)) {
                await tx.vehicleStock.upsert({
                    where: {
                        tripId_productId: { tripId: trip.id, productId },
                    },
                    update: { loadedQty },
                    create: {
                        tripId: trip.id,
                        productId,
                        loadedQty,
                        deliveredQty: 0,
                        excessQty: 0,
                        reallocatedQty: 0,
                        returnedQty: 0,
                    },
                });

                // Move from ALLOCATED to LOADED in inventory
                await tx.inventoryStock.upsert({
                    where: {
                        productId_batchId_state_location: {
                            productId,
                            batchId: null,
                            state: StockState.LOADED,
                            location: `VEHICLE:${trip.vehicle.regNumber}`,
                        },
                    },
                    update: { quantity: { increment: loadedQty } },
                    create: {
                        productId,
                        batchId: null,
                        state: StockState.LOADED,
                        location: `VEHICLE:${trip.vehicle.regNumber}`,
                        quantity: loadedQty,
                        tenantId: actor.tenantId || null,
                    },
                });

                await tx.inventoryMovement.create({
                    data: {
                        productId,
                        fromState: StockState.ALLOCATED,
                        toState: StockState.LOADED,
                        quantity: loadedQty,
                        referenceType: 'TRIP_DISPATCH',
                        referenceId: trip.id,
                        actorId: actor.id,
                        notes: `Loaded on ${trip.vehicle.regNumber} for ${trip.tripNumber}`,
                    },
                });
            }

            const updated = await tx.trip.update({
                where: { id: tripId },
                data: { status: TripStatus.LOADED },
                include: { vehicleStocks: { include: { product: true } } },
            });

            return updated;
        });
    }

    async dispatchTrip(actor, tripId, input) {
        const trip = await this.getTripById(tripId);
        if (trip.status !== TripStatus.LOADED) {
            throw ApiError.badRequest('NOT_LOADED', 'Trip must complete loading verification before dispatch');
        }

        return this.prisma.$transaction(async (tx) => {
            const startOdo = input.startOdometer ? Number(input.startOdometer) : 0;
            const updated = await tx.trip.update({
                where: { id: tripId },
                data: {
                    status: TripStatus.IN_TRANSIT,
                    departureTime: new Date(),
                    startOdometer: startOdo,
                },
            });

            // Set vehicle to IN_TRIP
            await tx.vehicle.update({
                where: { id: trip.vehicleId },
                data: { status: 'IN_TRIP' },
            });

            // Set first stop to EN_ROUTE
            if (trip.stops.length > 0) {
                await tx.tripStop.update({
                    where: { id: trip.stops[0].id },
                    data: { status: DeliveryStatus.EN_ROUTE },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.TRIP,
                entityId: trip.id,
                entityLabel: trip.tripNumber,
                action: AuditAction.TRIP_DISPATCHED,
                after: { tripNumber: trip.tripNumber, departureTime: updated.departureTime, startOdometer: startOdo },
            });

            return updated;
        });
    }

    async closeTrip(actor, tripId, input) {
        const trip = await this.getTripById(tripId);

        // PRD §18.3 Invariants: All stops must be resolved (not PLANNED or EN_ROUTE)
        const unresolvedStops = trip.stops.filter(s => s.status === DeliveryStatus.PLANNED || s.status === DeliveryStatus.EN_ROUTE);
        if (unresolvedStops.length > 0) {
            throw ApiError.badRequest('UNRESOLVED_STOPS', `Cannot close trip: ${unresolvedStops.length} stops are still pending completion`);
        }

        // Check for unresolved quantity exceptions
        const pendingExceptions = trip.quantityExceptions.filter(e => e.status === 'REQUESTED' || e.status === 'UNDER_REVIEW');
        if (pendingExceptions.length > 0) {
            throw ApiError.badRequest('PENDING_EXCEPTIONS', `Cannot close trip: ${pendingExceptions.length} quantity exceptions are pending review`);
        }

        return this.prisma.$transaction(async (tx) => {
            // Reconcile vehicle stock: returned goods move back into CENTRAL_WAREHOUSE AVAILABLE
            for (const stock of trip.vehicleStocks) {
                const returned = Number(stock.excessQty) - Number(stock.reallocatedQty);
                if (returned > 0) {
                    await tx.vehicleStock.update({
                        where: { id: stock.id },
                        data: { returnedQty: returned },
                    });

                    await tx.inventoryStock.upsert({
                        where: {
                            productId_batchId_state_location: {
                                productId: stock.productId,
                                batchId: null,
                                state: StockState.AVAILABLE,
                                location: 'CENTRAL_WAREHOUSE',
                            },
                        },
                        update: { quantity: { increment: returned } },
                        create: {
                            productId: stock.productId,
                            batchId: null,
                            state: StockState.AVAILABLE,
                            location: 'CENTRAL_WAREHOUSE',
                            quantity: returned,
                            tenantId: actor.tenantId || null,
                        },
                    });

                    await tx.inventoryMovement.create({
                        data: {
                            productId: stock.productId,
                            fromState: StockState.REMAINING_IN_VEHICLE,
                            toState: StockState.AVAILABLE,
                            quantity: returned,
                            referenceType: 'TRIP_RECONCILIATION',
                            referenceId: trip.id,
                            actorId: actor.id,
                            notes: `Returned from trip ${trip.tripNumber} to warehouse`,
                        },
                    });
                }
            }

            const endOdo = input.endOdometer ? Number(input.endOdometer) : trip.startOdometer;
            const updated = await tx.trip.update({
                where: { id: tripId },
                data: {
                    status: TripStatus.CLOSED,
                    returnTime: new Date(),
                    endOdometer: endOdo,
                },
            });

            // Release vehicle
            await tx.vehicle.update({
                where: { id: trip.vehicleId },
                data: { status: 'AVAILABLE' },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.TRIP,
                entityId: trip.id,
                entityLabel: trip.tripNumber,
                action: AuditAction.TRIP_CLOSED,
                after: { tripNumber: trip.tripNumber, returnTime: updated.returnTime, endOdometer: endOdo },
            });

            return updated;
        });
    }
};

DispatchService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], DispatchService);

export { DispatchService };
