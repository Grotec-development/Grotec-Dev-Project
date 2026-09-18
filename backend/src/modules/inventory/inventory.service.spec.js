import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service';

// Regression test: InventoryStock has a nullable batchId inside its compound unique
// index (productId, batchId, state, location). Prisma's generated compound-unique
// input requires batchId to be a non-null string, so upsert({ where: { ...compound } })
// throws when batchId is null. adjustStock must use findFirst + create/update instead.
describe('InventoryService.adjustStock — null-batchId stock rows', () => {
    function buildTx({ existingStock }) {
        return {
            inventoryStock: {
                findFirst: vi.fn().mockResolvedValue(existingStock),
                update: vi.fn().mockResolvedValue({ id: existingStock?.id, quantity: 20 }),
                create: vi.fn().mockResolvedValue({ id: 'new-stock', quantity: 10 }),
            },
            inventoryMovement: { create: vi.fn() },
        };
    }

    it('creates a new stock row when no matching (productId, null batchId, state, location) row exists', async () => {
        const tx = buildTx({ existingStock: null });
        const mockPrisma = { $transaction: vi.fn((cb) => cb(tx)) };
        const service = new InventoryService(mockPrisma, { record: vi.fn() });

        await service.adjustStock({ id: 'emp-1', tenantId: 't1' }, {
            productId: 'prod-1',
            batchId: null,
            state: 'AVAILABLE',
            quantity: 10,
            reason: 'test',
        });

        expect(tx.inventoryStock.findFirst).toHaveBeenCalledWith({
            where: { productId: 'prod-1', batchId: null, state: 'AVAILABLE', location: 'CENTRAL_WAREHOUSE' },
        });
        expect(tx.inventoryStock.create).toHaveBeenCalled();
        expect(tx.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('increments the existing row instead of erroring when one already exists', async () => {
        const tx = buildTx({ existingStock: { id: 'stock-1', quantity: 10 } });
        const mockPrisma = { $transaction: vi.fn((cb) => cb(tx)) };
        const service = new InventoryService(mockPrisma, { record: vi.fn() });

        await service.adjustStock({ id: 'emp-1', tenantId: 't1' }, {
            productId: 'prod-1',
            batchId: null,
            state: 'AVAILABLE',
            quantity: 10,
            reason: 'test',
        });

        expect(tx.inventoryStock.update).toHaveBeenCalledWith({
            where: { id: 'stock-1' },
            data: { quantity: { increment: 10 } },
        });
        expect(tx.inventoryStock.create).not.toHaveBeenCalled();
    });
});
