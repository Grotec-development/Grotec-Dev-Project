import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service';

describe('ProductsService — Phase 2 Catalogue & Pricing', () => {
    it('creates product with clean SKU, GST rate, and records audit', async () => {
        const mockPrisma = {
            product: {
                findUnique: vi.fn().mockResolvedValue(null),
                findMany: vi.fn(),
            },
            $transaction: vi.fn(async (cb) => {
                const tx = {
                    product: {
                        create: vi.fn().mockResolvedValue({
                            id: 'prod-1',
                            sku: 'GRO-BIO-PF-1L',
                            name: 'Bio Jeevan PF',
                            basePrice: 380,
                            gstRate: 5.0,
                        }),
                    },
                };
                return cb(tx);
            }),
        };

        const mockAudit = { record: vi.fn() };
        const service = new ProductsService(mockPrisma, mockAudit);

        const actor = { id: 'emp-1', fullName: 'Founder', tenantId: 'tenant-1' };
        const result = await service.create(actor, {
            sku: 'gro-bio-pf-1l',
            name: 'Bio Jeevan PF',
            basePrice: 380,
            gstRate: 5.0,
        });

        expect(result.sku).toBe('GRO-BIO-PF-1L');
        expect(result.basePrice).toBe(380);
        expect(mockAudit.record).toHaveBeenCalled();
    });

    it('rejects duplicate SKU creation with conflict', async () => {
        const mockPrisma = {
            product: {
                findUnique: vi.fn().mockResolvedValue({ id: 'existing-id', sku: 'GRO-BIO-PF-1L' }),
            },
        };
        const mockAudit = { record: vi.fn() };
        const service = new ProductsService(mockPrisma, mockAudit);

        await expect(service.create({ id: 'emp-1' }, {
            sku: 'GRO-BIO-PF-1L',
            name: 'Duplicate Product',
            basePrice: 380,
        })).rejects.toThrow('already exists');
    });
});
