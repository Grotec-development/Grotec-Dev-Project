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
import { AuditAction, AuditEntityType, OrderStatus, StockState, isTopTier, districtSpellings, toTechnicalRole } from '@grotec/shared';

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
        if (query.routeId) where.routeId = query.routeId;
        if (query.agentId) where.createdById = query.agentId;

        return this.prisma.salesOrder.findMany({
            where,
            include: {
                customer: { select: { id: true, fullName: true, farmerCode: true, phones: { where: { isPrimary: true }, select: { phoneE164: true } }, locations: { where: { deletedAt: null }, select: { district: true, taluk: true, village: true } } } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, unit: true } },
                    },
                },
                invoice: true,
                payments: true,
                route: { select: { id: true, name: true, code: true } },
                createdBy: { select: { id: true, fullName: true } },
                location: true,
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
                location: true,
                items: {
                    include: {
                        product: true,
                        quantityExceptions: true,
                    },
                },
                invoice: true,
                payments: true,
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
            include: { locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
        });
        if (!customer) {
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', `Customer ${input.customerId} not found`);
        }

        if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
            throw ApiError.badRequest('ITEMS_REQUIRED', 'At least one order item is required');
        }

        // 1. Delivery location resolution & immutable address snapshot
        let selectedLocation = null;
        if (input.locationId) {
            selectedLocation = customer.locations.find((l) => l.id === input.locationId);
            if (!selectedLocation) {
                throw ApiError.notFound('LOCATION_NOT_FOUND', `Selected farm location ${input.locationId} not found on this customer`);
            }
        } else if (customer.locations.length > 0) {
            selectedLocation = customer.locations[0];
        }

        let deliveryAddress = input.deliveryAddress;
        if (!deliveryAddress && selectedLocation) {
            const parts = [
                selectedLocation.locationName || selectedLocation.customName,
                selectedLocation.addressLine,
                selectedLocation.village,
                selectedLocation.taluk,
                selectedLocation.district,
                selectedLocation.state ? `${selectedLocation.state}${selectedLocation.pincode ? ' - ' + selectedLocation.pincode : ''}` : selectedLocation.pincode,
            ].filter(Boolean);
            deliveryAddress = parts.join(', ');
        }
        if (!deliveryAddress) {
            deliveryAddress = 'Farm address';
        }

        // 2. Automatic route corridor suggestion based on district
        let routeId = input.routeId || null;
        const targetDistrict = selectedLocation?.district || (typeof deliveryAddress === 'string' && deliveryAddress.includes('Coimbatore') ? 'Coimbatore' : null);
        if (!routeId && targetDistrict) {
            const routes = await this.prisma.deliveryRoute.findMany({
                where: { isActive: true },
                include: { districts: true },
            });
            const spellings = districtSpellings(targetDistrict).map((s) => s.toLowerCase());
            const matchedRoute = routes.find((r) =>
                r.districts?.some((d) => spellings.includes((d.district || '').toLowerCase()))
            );
            if (matchedRoute) {
                routeId = matchedRoute.id;
            }
        }

        // 3. Discount authority check
        const isAuthorizedSupervisor =
            toTechnicalRole(actor.roleCode) !== 'AGENT' &&
            (isTopTier(actor.roleCode) ||
                actor.roleCode === 'MANAGER' ||
                actor.permissions?.includes('orders.discount.approve'));

        let totalRequestedDiscount = 0;
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
            const itemDiscount = Number(item.discount || 0);
            totalRequestedDiscount += itemDiscount;

            // Only apply discount immediately if supervisor authorized; otherwise regular price applies until approved
            const appliedDiscount = isAuthorizedSupervisor ? itemDiscount : 0;
            const taxableAmount = Math.max(0, (unitPrice * qty) - appliedDiscount);
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
                discount: appliedDiscount,
                totalAmount: itemTotal,
            });
        }

        if (input.discountAmount && Number(input.discountAmount) > 0) {
            totalRequestedDiscount += Number(input.discountAmount);
        }

        const grandTotal = subtotal + totalTax;
        const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const orderNumber = `SO-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
        const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 4. Large-order advance payment controls (Section 11.2)
        const ADVANCE_PAYMENT_THRESHOLD = 100000; // ₹1,00,000 threshold
        let advanceRequiredAmount = null;
        let advancePaymentStatus = null;
        if (grandTotal >= ADVANCE_PAYMENT_THRESHOLD) {
            advanceRequiredAmount = Math.round(grandTotal * 0.25 * 100) / 100; // 25% provisional advance
            advancePaymentStatus = 'PENDING';
        }

        let discountStatus = null;
        let discountApprovedAmount = null;
        let discountApprovedById = null;
        let discountApprovedAt = null;
        let discountRequestedAmount = null;

        if (totalRequestedDiscount > 0) {
            if (isAuthorizedSupervisor) {
                discountStatus = 'APPROVED';
                discountApprovedAmount = totalRequestedDiscount;
                discountApprovedById = actor.id;
                discountApprovedAt = new Date();
            } else {
                discountStatus = 'PENDING_APPROVAL';
                discountRequestedAmount = totalRequestedDiscount;
            }
        }

        return this.prisma.$transaction(async (tx) => {
            const orderStatus = input.status || (input.submitOnly ? 'SUBMITTED' : OrderStatus.CONFIRMED);
            const order = await tx.salesOrder.create({
                data: {
                    orderNumber,
                    customer: { connect: { id: customer.id } },
                    ...(selectedLocation?.id ? { location: { connect: { id: selectedLocation.id } } } : {}),
                    status: orderStatus,
                    subtotal,
                    discountAmount: isAuthorizedSupervisor ? totalRequestedDiscount : 0,
                    discountRequestedAmount: discountRequestedAmount || 0,
                    discountApprovedAmount: discountApprovedAmount || 0,
                    discountReason: input.discountReason || null,
                    discountStatus: discountStatus || 'NONE',
                    ...(discountApprovedById ? { discountApprovedBy: { connect: { id: discountApprovedById } } } : {}),
                    discountApprovedAt,
                    advanceRequiredAmount: advanceRequiredAmount || 0,
                    advancePaidAmount: 0,
                    advancePaymentStatus: advancePaymentStatus || 'NOT_REQUIRED',
                    taxAmount: totalTax,
                    totalAmount: grandTotal,
                    paymentStatus: input.paymentStatus || 'UNPAID',
                    paymentMethod: input.paymentMethod || 'CASH_ON_DELIVERY',
                    deliveryAddress,
                    ...(routeId ? { route: { connect: { id: routeId } } } : {}),
                    requestedDeliveryDate: input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : null,
                    deliveryConfirmationStatus: 'PENDING',
                    notes: input.notes || null,
                    ...(actor.id ? { createdBy: { connect: { id: actor.id } } } : {}),
                    ...(actor.tenantId ? { tenant: { connect: { id: actor.tenantId } } } : {}),
                    items: {
                        create: processedItems,
                    },
                },
                include: { items: { include: { product: true } }, route: true, location: true },
            });

            // Create initial Invoice
            const halfTax = totalTax / 2;
            const invoice = await tx.invoice.create({
                data: {
                    order: { connect: { id: order.id } },
                    invoiceNumber,
                    subtotal,
                    cgst: halfTax,
                    sgst: halfTax,
                    igst: 0,
                    total: grandTotal,
                    paidAmount: 0,
                    outstandingAmount: grandTotal,
                    status: 'ISSUED',
                    isRevised: false,
                },
            });

            // Allocate inventory stock
            await Promise.all(
                processedItems.map(async (item) => {
                    const existingStock = await tx.inventoryStock.findFirst({
                        where: {
                            productId: item.productId,
                            batchId: null,
                            state: StockState.ALLOCATED,
                            location: 'CENTRAL_WAREHOUSE',
                        },
                    });
                    if (existingStock) {
                        await tx.inventoryStock.update({
                            where: { id: existingStock.id },
                            data: { quantity: { increment: item.approvedQty } },
                        });
                    } else {
                        await tx.inventoryStock.create({
                            data: {
                                productId: item.productId,
                                batchId: null,
                                state: StockState.ALLOCATED,
                                location: 'CENTRAL_WAREHOUSE',
                                quantity: item.approvedQty,
                                tenantId: actor.tenantId || null,
                            },
                        });
                    }

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
                })
            );

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: order.id,
                entityLabel: order.orderNumber,
                action: AuditAction.ORDER_PLACED,
                after: {
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    customerId: customer.id,
                    locationId: selectedLocation?.id || null,
                    advancePaymentStatus,
                    discountStatus,
                },
            });

            return {
                ...order,
                invoice,
            };
        }, { timeout: 35000, maxWait: 20000 });
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

    async approveDiscount(actor, id, dto) {
        const isAuthorizedSupervisor =
            isTopTier(actor.roleCode) ||
            actor.roleCode === 'MANAGER' ||
            actor.permissions?.includes('orders.discount.approve') ||
            actor.permissions?.includes('orders.manage');

        if (!isAuthorizedSupervisor) {
            throw ApiError.forbidden('DISCOUNT_APPROVAL_FORBIDDEN', 'Only authorized managers can approve discounts');
        }

        const order = await this.getOrderById(actor, id);
        const approvedAmount = Number(dto.approvedAmount ?? order.discountRequestedAmount ?? 0);

        return this.prisma.$transaction(async (tx) => {
            const newSubtotal = Math.max(0, order.subtotal - approvedAmount);
            const newTax = (newSubtotal * 0.05);
            const newTotal = newSubtotal + newTax;

            const updatedOrder = await tx.salesOrder.update({
                where: { id },
                data: {
                    discountStatus: 'APPROVED',
                    discountApprovedAmount: approvedAmount,
                    discountAmount: approvedAmount,
                    discountApprovedById: actor.id,
                    discountApprovedAt: new Date(),
                    subtotal: newSubtotal,
                    taxAmount: newTax,
                    totalAmount: newTotal,
                },
            });

            if (order.invoice) {
                const halfTax = newTax / 2;
                await tx.invoice.update({
                    where: { id: order.invoice.id },
                    data: {
                        subtotal: newSubtotal,
                        cgst: halfTax,
                        sgst: halfTax,
                        total: newTotal,
                        outstandingAmount: Math.max(0, newTotal - (order.invoice.paidAmount || 0)),
                    },
                });
            }

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: id,
                entityLabel: order.orderNumber,
                action: 'discount.approved',
                after: { approvedAmount, approverId: actor.id, reason: dto.reason },
            });

            return updatedOrder;
        });
    }

    async rejectDiscount(actor, id, dto) {
        const isAuthorizedSupervisor =
            isTopTier(actor.roleCode) ||
            actor.roleCode === 'MANAGER' ||
            actor.permissions?.includes('orders.discount.approve') ||
            actor.permissions?.includes('orders.manage');

        if (!isAuthorizedSupervisor) {
            throw ApiError.forbidden('DISCOUNT_APPROVAL_FORBIDDEN', 'Only authorized managers can reject discounts');
        }

        const order = await this.getOrderById(actor, id);

        return this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.salesOrder.update({
                where: { id },
                data: {
                    discountStatus: 'REJECTED',
                    discountRejectionReason: dto.reason || 'Discount rejected by supervisor',
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: id,
                entityLabel: order.orderNumber,
                action: 'discount.rejected',
                after: { approverId: actor.id, reason: dto.reason },
            });

            return updatedOrder;
        });
    }

    async approveAdvanceException(actor, id, dto) {
        const isAuthorizedSupervisor =
            isTopTier(actor.roleCode) ||
            actor.roleCode === 'MANAGER' ||
            actor.permissions?.includes('orders.advance.approve') ||
            actor.permissions?.includes('orders.manage');

        if (!isAuthorizedSupervisor) {
            throw ApiError.forbidden('ADVANCE_EXCEPTION_FORBIDDEN', 'Only authorized managers can approve advance payment exceptions');
        }

        const order = await this.getOrderById(actor, id);

        return this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.salesOrder.update({
                where: { id },
                data: {
                    advancePaymentStatus: 'EXCEPTION_APPROVED',
                    advanceExceptionApprovedById: actor.id,
                    advanceExceptionApprovedAt: new Date(),
                    advanceExceptionReason: dto.reason || 'Manager exception granted',
                },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: id,
                entityLabel: order.orderNumber,
                action: 'advance_exception.approved',
                after: { approverId: actor.id, reason: dto.reason },
            });

            return updatedOrder;
        });
    }

    async recordPayment(actor, orderId, paymentDto) {
        const order = await this.getOrderById(actor, orderId);
        const amount = Number(paymentDto.amount);
        if (!amount || amount <= 0) {
            throw ApiError.badRequest('INVALID_PAYMENT_AMOUNT', 'Payment amount must be greater than zero');
        }

        const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const paymentNumber = `PAY-${dateCode}-${Math.floor(1000 + Math.random() * 9000)}`;

        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    tenantId: actor.tenantId || null,
                    paymentNumber,
                    orderId,
                    invoiceId: order.invoice?.id || null,
                    amount,
                    paymentMethod: paymentDto.paymentMethod || 'CASH',
                    referenceNumber: paymentDto.referenceNumber || null,
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedById: actor.id,
                    notes: paymentDto.notes || null,
                    createdById: actor.id,
                },
            });

            const newAdvancePaid = (order.advancePaidAmount || 0) + amount;
            const updates = { advancePaidAmount: newAdvancePaid };

            if (order.advanceRequiredAmount && newAdvancePaid >= order.advanceRequiredAmount && order.advancePaymentStatus === 'PENDING') {
                updates.advancePaymentStatus = 'PAID';
            }

            if (order.invoice) {
                const currentPaid = (order.invoice.paidAmount || 0) + amount;
                const newOutstanding = Math.max(0, order.invoice.total - currentPaid);
                const invStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

                await tx.invoice.update({
                    where: { id: order.invoice.id },
                    data: {
                        paidAmount: currentPaid,
                        outstandingAmount: newOutstanding,
                        status: invStatus,
                    },
                });

                updates.paymentStatus = invStatus;
            }

            const updatedOrder = await tx.salesOrder.update({
                where: { id: orderId },
                data: updates,
                include: { payments: true, invoice: true },
            });

            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.SALES_ORDER,
                entityId: orderId,
                entityLabel: order.orderNumber,
                action: 'payment.recorded',
                after: { paymentNumber, amount, paymentMethod: paymentDto.paymentMethod },
            });

            return { payment, order: updatedOrder };
        });
    }

    async getAccountsLedger(actor, query = {}) {
        const where = {};
        if (query.status) where.status = query.status;

        return this.prisma.invoice.findMany({
            where,
            include: {
                order: {
                    include: {
                        customer: { select: { id: true, fullName: true, farmerCode: true, phones: { where: { isPrimary: true } } } },
                        payments: true,
                        route: true,
                    },
                },
                payments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};

OrdersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], OrdersService);

export { OrdersService };
