var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockState } from '@grotec/shared';

let RoutesService = class RoutesService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    async listRoutes(includeInactive = false) {
        return this.prisma.deliveryRoute.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: {
                districts: {
                    orderBy: { district: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    async getRouteById(id) {
        const route = await this.prisma.deliveryRoute.findUnique({
            where: { id },
            include: {
                districts: true,
            },
        });
        if (!route) {
            throw ApiError.notFound('ROUTE_NOT_FOUND', `Route ${id} not found`);
        }
        return route;
    }

    async getRouteByDistrict(districtName) {
        if (!districtName) return null;
        const mapping = await this.prisma.routeDistrict.findFirst({
            where: {
                district: { equals: districtName.trim(), mode: 'insensitive' },
            },
            include: { route: true },
        });
        return mapping?.route || null;
    }

    async assignDistrict(actor, routeId, data) {
        await this.getRouteById(routeId);
        const district = (data.district || '').trim();
        if (!district) throw ApiError.badRequest('DISTRICT_REQUIRED', 'District name is required');
        const towns = Array.isArray(data.towns) ? data.towns : [];

        return this.prisma.routeDistrict.upsert({
            where: { routeId_district: { routeId, district } },
            update: { towns },
            create: { routeId, district, towns },
        });
    }

    async removeDistrict(actor, routeId, district) {
        return this.prisma.routeDistrict.deleteMany({
            where: { routeId, district },
        });
    }

    /**
     * Transport and Route-Based Operational Dashboard (Phase 10)
     */
    async getRouteDashboard(query = {}) {
        const routes = await this.listRoutes(false);
        const dashboard = [];

        for (const route of routes) {
            const districtNames = route.districts.map((d) => d.district);

            // Find all sales orders mapped to this route directly OR via customer primary location district
            const orders = await this.prisma.salesOrder.findMany({
                where: {
                    deletedAt: null,
                    OR: [
                        { routeId: route.id },
                        {
                            customer: {
                                locations: {
                                    some: {
                                        deletedAt: null,
                                        isPrimary: true,
                                        district: { in: districtNames, mode: 'insensitive' },
                                    },
                                },
                            },
                        },
                    ],
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            farmerCode: true,
                            fullName: true,
                            phones: { where: { deletedAt: null }, select: { phoneE164: true, isPrimary: true } },
                            locations: { where: { deletedAt: null }, select: { district: true, taluk: true, village: true } },
                        },
                    },
                    items: {
                        include: { product: { select: { id: true, name: true, unit: true } } },
                    },
                    createdBy: { select: { id: true, fullName: true } },
                },
                orderBy: { orderDate: 'desc' },
            });

            // Group metrics
            let totalRequestedQty = 0;
            let confirmedDeliveryQty = 0;
            let pendingConfirmationCount = 0;
            let confirmedOrdersCount = 0;
            let dispatchedCount = 0;
            let completedCount = 0;
            let deferredCount = 0;

            for (const o of orders) {
                let orderQty = 0;
                for (const item of o.items) {
                    orderQty += Number(item.approvedQty || item.originalQty || 0);
                }
                totalRequestedQty += orderQty;

                if (o.status === 'SUBMITTED' || o.deliveryConfirmationStatus === 'REQUIRES_FURTHER_CONTACT' || !o.deliveryConfirmationStatus) {
                    pendingConfirmationCount++;
                }
                if (o.status === 'CONFIRMED' || o.deliveryConfirmationStatus === 'CONFIRMED_FOR_DELIVERY') {
                    confirmedOrdersCount++;
                    confirmedDeliveryQty += orderQty;
                }
                if (o.status === 'DISPATCHED') {
                    dispatchedCount++;
                }
                if (o.status === 'DELIVERED' || o.status === 'COMPLETED') {
                    completedCount++;
                }
                if (o.deliveryConfirmationStatus === 'RESCHEDULED' || o.deliveryConfirmationStatus === 'CUSTOMER_UNAVAILABLE') {
                    deferredCount++;
                }
            }

            // Available warehouse stock for the products frequently requested in this route
            const topProductIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))].slice(0, 5);
            const stocks = await this.prisma.inventoryStock.findMany({
                where: {
                    productId: { in: topProductIds },
                    state: StockState.AVAILABLE,
                },
                include: { product: { select: { id: true, name: true, unit: true } } },
            });

            dashboard.push({
                routeId: route.id,
                routeCode: route.code,
                routeName: route.name,
                description: route.description,
                districts: route.districts,
                metrics: {
                    totalOrders: orders.length,
                    pendingConfirmationCount,
                    confirmedOrdersCount,
                    dispatchedCount,
                    completedCount,
                    deferredCount,
                    totalRequestedQty: Math.round(totalRequestedQty * 100) / 100,
                    confirmedDeliveryQty: Math.round(confirmedDeliveryQty * 100) / 100,
                },
                availableStockSample: stocks.map((s) => ({
                    product: s.product.name,
                    unit: s.product.unit,
                    available: Number(s.quantity),
                })),
                orders,
            });
        }

        return dashboard;
    }

    /**
     * Customer Delivery Confirmation Workflow (Phase 10.4)
     * Delivery officer contacts customer and confirms readiness, date, or rescheduling.
     */
    async confirmCustomerDelivery(actor, orderId, data) {
        const order = await this.prisma.salesOrder.findUnique({
            where: { id: orderId },
            include: { customer: true, items: true },
        });
        if (!order) throw ApiError.notFound('ORDER_NOT_FOUND', 'Order not found');

        const outcome = data.outcome || data.confirmationStatus; // CONFIRMED_FOR_DELIVERY | RESCHEDULED | CUSTOMER_UNAVAILABLE | CANCELLED | REQUIRES_FURTHER_CONTACT
        const deliveryDate = data.confirmedDeliveryDate ? new Date(data.confirmedDeliveryDate) : null;
        const notes = data.notes || null;

        let newOrderStatus = order.status;
        if (outcome === 'CONFIRMED_FOR_DELIVERY') {
            newOrderStatus = 'CONFIRMED';
        } else if (outcome === 'CANCELLED') {
            newOrderStatus = 'CANCELLED';
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    deliveryConfirmationStatus: outcome,
                    confirmedDeliveryDate: deliveryDate,
                    confirmationNotes: notes,
                    status: newOrderStatus,
                    confirmedAt: outcome === 'CONFIRMED_FOR_DELIVERY' ? new Date() : order.confirmedAt,
                    ...(data.routeId ? { routeId: data.routeId } : {}),
                },
                include: { customer: true, items: { include: { product: true } } },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SALES_ORDER',
                entityId: orderId,
                entityLabel: order.orderNumber,
                action: 'delivery_confirmation',
                after: { outcome, deliveryDate, notes, status: newOrderStatus },
            });

            return updated;
        });
    }
};

RoutesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService, AuditService])
], RoutesService);

export { RoutesService };
