import { describe, expect, it, vi } from 'vitest';
import { DispatchService } from './dispatch.service';
import { ExceptionsService } from '../exceptions/exceptions.service';
import { TripStatus, DeliveryStatus, QuantityExceptionStatus } from '@grotec/shared';

describe('DispatchService & ExceptionsService — PRD §18 Lifecycle & Exception Engine', () => {
    describe('Dispatch Loading Verification (PRD §18.1)', () => {
        it('blocks dispatch when a loading mismatch occurs', async () => {
            const mockPrisma = {
                trip: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 'trip-1',
                        status: TripStatus.PLANNED,
                        stops: [],
                    }),
                },
            };
            const service = new DispatchService(mockPrisma, { record: vi.fn() });

            await expect(service.verifyLoading({ id: 'emp-1' }, 'trip-1', { hasMismatch: true }))
                .rejects.toThrow('Loading mismatch blocks dispatch');
        });

        it('successfully loads trip and registers vehicle stock when verified', async () => {
            const mockTrip = {
                id: 'trip-1',
                tripNumber: 'TRP-20260914-001',
                status: TripStatus.PLANNED,
                vehicle: { regNumber: 'TN-29-BA-4589' },
                stops: [
                    {
                        order: {
                            items: [
                                { productId: 'prod-1', approvedQty: 10 },
                                { productId: 'prod-2', approvedQty: 5 },
                            ],
                        },
                    },
                ],
            };

            const mockPrisma = {
                trip: {
                    findUnique: vi.fn().mockResolvedValue(mockTrip),
                },
                $transaction: vi.fn(async (cb) => {
                    const tx = {
                        vehicleStock: { upsert: vi.fn() },
                        inventoryStock: { upsert: vi.fn() },
                        inventoryMovement: { create: vi.fn() },
                        trip: {
                            update: vi.fn().mockResolvedValue({ ...mockTrip, status: TripStatus.LOADED }),
                        },
                    };
                    return cb(tx);
                }),
            };

            const service = new DispatchService(mockPrisma, { record: vi.fn() });
            const result = await service.verifyLoading({ id: 'emp-1' }, 'trip-1', { hasMismatch: false });

            expect(result.status).toBe(TripStatus.LOADED);
        });
    });

    describe('Trip Closure Reconciliation (PRD §18.3)', () => {
        it('refuses closure if any stop is unresolved (still PLANNED or EN_ROUTE)', async () => {
            const mockPrisma = {
                trip: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 'trip-1',
                        status: TripStatus.DELIVERING,
                        stops: [
                            { id: 'stop-1', status: DeliveryStatus.COMPLETED },
                            { id: 'stop-2', status: DeliveryStatus.EN_ROUTE },
                        ],
                        quantityExceptions: [],
                        vehicleStocks: [],
                    }),
                },
            };

            const service = new DispatchService(mockPrisma, { record: vi.fn() });
            await expect(service.closeTrip({ id: 'emp-1' }, 'trip-1', {}))
                .rejects.toThrow('stops are still pending completion');
        });
    });

    describe('Dynamic Quantity Exception Handling (PRD §18.2)', () => {
        it('returns undelivered units to vehicle stock pool and automatically revises invoice on approval', async () => {
            const mockException = {
                id: 'ex-1',
                tripId: 'trip-1',
                status: QuantityExceptionStatus.REQUESTED,
                requestedQty: 80,
                orderItem: {
                    id: 'item-1',
                    orderId: 'order-1',
                    productId: 'prod-1',
                    unitPrice: 100,
                    taxRate: 5.0,
                    discount: 0,
                    originalQty: 100,
                    approvedQty: 100,
                    product: { name: 'Bio Jeevan PF' },
                },
            };

            const upsertVehicleStock = vi.fn();
            const updateInvoice = vi.fn();
            const updateException = vi.fn().mockResolvedValue({ ...mockException, status: QuantityExceptionStatus.APPROVED, approvedQty: 80 });

            const mockPrisma = {
                quantityException: {
                    findUnique: vi.fn().mockResolvedValue(mockException),
                },
                $transaction: vi.fn(async (cb) => {
                    const tx = {
                        salesOrderItem: {
                            update: vi.fn(),
                            findMany: vi.fn().mockResolvedValue([
                                { id: 'item-1', approvedQty: 80, unitPrice: 100, taxRate: 5.0, discount: 0 },
                            ]),
                        },
                        vehicleStock: { upsert: upsertVehicleStock },
                        salesOrder: { update: vi.fn() },
                        invoice: { updateMany: updateInvoice },
                        quantityException: { update: updateException },
                    };
                    return cb(tx);
                }),
            };

            const mockAudit = { record: vi.fn() };
            const service = new ExceptionsService(mockPrisma, mockAudit);

            const result = await service.reviewException({ id: 'mgr-1' }, 'ex-1', { decision: 'APPROVE' });

            expect(result.status).toBe(QuantityExceptionStatus.APPROVED);
            // Verify excess units (100 - 80 = 20) were returned to the vehicle stock pool
            expect(upsertVehicleStock).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: { excessQty: { increment: 20 } },
                })
            );
            // Verify invoice was automatically revised
            expect(updateInvoice).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        isRevised: true,
                        status: 'REVISED',
                    }),
                })
            );
        });
    });
});
