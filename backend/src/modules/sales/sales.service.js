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
import { isTopTier } from '@grotec/shared';

const SALE_INCLUDE = {
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
        include: {
            product: { select: { id: true, name: true, sku: true, unit: true, hsnCode: true } },
        },
    },
    invoice: true,
    createdBy: { select: { id: true, fullName: true, employeeCode: true } },
    route: { select: { id: true, name: true, code: true } },
    tripStops: {
        include: {
            trip: {
                select: {
                    id: true,
                    tripNumber: true,
                    status: true,
                    driver: { select: { id: true, fullName: true, phone: true } },
                },
            },
        },
    },
};

let SalesService = class SalesService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }

    /**
     * List actual completed sales separately from draft/submitted orders.
     */
    async listSales(actor, query = {}) {
        const where = {
            deletedAt: null,
            // A completed sale must have status COMPLETED or DELIVERED
            status: { in: ['COMPLETED', 'DELIVERED'] },
        };

        // Scoping: Agents see their own orders unless management
        if (actor.roleCode === 'AGENT' && !isTopTier(actor.roleCode)) {
            where.createdById = actor.id;
        } else if (query.agentId) {
            where.createdById = query.agentId;
        }

        if (query.customerId) where.customerId = query.customerId;
        if (query.district) {
            where.customer = {
                locations: {
                    some: {
                        district: { equals: query.district, mode: 'insensitive' },
                        deletedAt: null,
                    },
                },
            };
        }
        if (query.routeId) where.routeId = query.routeId;
        if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

        if (query.startDate || query.endDate) {
            where.completedAt = {};
            if (query.startDate) where.completedAt.gte = new Date(query.startDate);
            if (query.endDate) where.completedAt.lte = new Date(query.endDate);
        }

        return this.prisma.salesOrder.findMany({
            where,
            include: SALE_INCLUDE,
            orderBy: [{ completedAt: 'desc' }, { orderDate: 'desc' }],
        });
    }

    async getSaleById(actor, id) {
        const sale = await this.prisma.salesOrder.findFirst({
            where: {
                id,
                deletedAt: null,
                status: { in: ['COMPLETED', 'DELIVERED'] },
                ...(actor.roleCode === 'AGENT' && !isTopTier(actor.roleCode) ? { createdById: actor.id } : {}),
            },
            include: SALE_INCLUDE,
        });

        if (!sale) {
            throw ApiError.notFound('SALE_NOT_FOUND', `Completed sale ${id} not found or not accessible`);
        }
        return sale;
    }

    /**
     * Complete a sale upon delivery confirmation and stock reconciliation (Phase 6.3 & 10.8)
     */
    async completeSale(actor, orderId, data = {}) {
        const order = await this.prisma.salesOrder.findUnique({
            where: { id: orderId },
            include: { customer: true, invoice: true, items: true },
        });
        if (!order) throw ApiError.notFound('ORDER_NOT_FOUND', 'Order not found');

        const completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
        const paymentStatus = data.paymentStatus || 'PAID';

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    status: 'COMPLETED',
                    completedAt,
                    paymentStatus,
                    notes: data.notes ? `${order.notes || ''} [Completed: ${data.notes}]` : order.notes,
                },
                include: SALE_INCLUDE,
            });

            // Ensure invoice is finalized
            if (order.invoice && order.invoice.status !== 'PAID' && paymentStatus === 'PAID') {
                await tx.invoice.update({
                    where: { id: order.invoice.id },
                    data: { status: 'PAID' },
                });
            }

            // Lead-to-client conversion on qualifying completed sale (Section 5)
            if (order.customer && order.customer.relationshipStage !== 'CLIENT') {
                await tx.customer.update({
                    where: { id: order.customerId },
                    data: {
                        relationshipStage: 'CLIENT',
                        clientSince: order.customer.clientSince || completedAt,
                        conversionSource: 'QUALIFYING_PURCHASE',
                    },
                });
                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: 'CUSTOMER',
                    entityId: order.customerId,
                    entityLabel: order.customer.fullName,
                    action: 'customer.converted_to_client',
                    after: { relationshipStage: 'CLIENT', clientSince: completedAt, qualifyingOrderId: orderId },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'SALES_ORDER',
                entityId: orderId,
                entityLabel: order.orderNumber,
                action: 'sale.completed',
                after: { status: 'COMPLETED', completedAt, totalAmount: order.totalAmount },
            });

            return updated;
        });
    }

    /**
     * Generate or fetch printable invoice data for an order (Phase 6.5)
     */
    async getOrGenerateInvoice(actor, orderId) {
        const order = await this.prisma.salesOrder.findUnique({
            where: { id: orderId },
            include: {
                customer: {
                    include: {
                        phones: { where: { deletedAt: null } },
                        locations: { where: { deletedAt: null } },
                    },
                },
                items: { include: { product: true } },
                invoice: true,
                createdBy: { select: { fullName: true, employeeCode: true } },
            },
        });
        if (!order) throw ApiError.notFound('ORDER_NOT_FOUND', 'Order not found');

        // Check if invoice exists; if not, generate one
        let invoice = order.invoice;
        if (!invoice) {
            const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
            const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
            const halfTax = Number(order.taxAmount) / 2;

            invoice = await this.prisma.invoice.create({
                data: {
                    orderId: order.id,
                    invoiceNumber,
                    subtotal: order.subtotal,
                    cgst: halfTax,
                    sgst: halfTax,
                    igst: 0,
                    total: order.totalAmount,
                    status: order.paymentStatus === 'PAID' ? 'PAID' : 'ISSUED',
                    isRevised: false,
                },
            });
        }

        // Return rich printable structure
        return {
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            status: invoice.status,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            company: {
                name: 'GROTEC Agro Products',
                address: 'HQ & Testing Labs, Dharmapuri, Tamil Nadu, India - 636701',
                phone: '+91 94443 30285',
                email: 'support@grotecagro.com',
                gstin: '33AABCG1234F1Z8',
                website: 'grotecagro.com',
            },
            customer: {
                farmerCode: order.customer.farmerCode,
                fullName: order.customer.fullName,
                phone: order.customer.phones[0]?.phoneE164 || '',
                address: order.deliveryAddress || order.customer.locations[0]?.addressLine || 'Farm address',
                district: order.customer.locations[0]?.district || '',
                state: order.customer.locations[0]?.state || 'Tamil Nadu',
            },
            lineItems: order.items.map((item) => ({
                productName: item.product.name,
                sku: item.product.sku,
                hsn: item.product.hsnCode || '31010099',
                quantity: Number(item.deliveredQty > 0 ? item.deliveredQty : (item.approvedQty || item.originalQty)),
                unit: item.product.unit,
                unitPrice: Number(item.unitPrice),
                discount: Number(item.discount),
                taxRate: Number(item.taxRate),
                taxAmount: Number(item.taxAmount),
                total: Number(item.totalAmount),
            })),
            financials: {
                subtotal: Number(invoice.subtotal),
                cgst: Number(invoice.cgst),
                sgst: Number(invoice.sgst),
                igst: Number(invoice.igst),
                grandTotal: Number(invoice.total),
            },
            agent: order.createdBy?.fullName || 'Sales Executive',
        };
    }
};

SalesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService, AuditService])
], SalesService);

export { SalesService };
