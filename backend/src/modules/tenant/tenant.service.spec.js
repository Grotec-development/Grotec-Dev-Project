import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TenantService, DEFAULT_TENANT_SLUG, DEFAULT_TENANT_NAME } from './tenant.service';
import { TenantController } from './tenant.controller';
import { ApiError } from '../../common/errors/api-error';

describe('TenantService & TenantController (Multi-Tenancy)', () => {
  let prisma;
  let tenantService;
  let tenantController;

  const mockTenant = {
    id: 'tenant-grotec-001',
    name: DEFAULT_TENANT_NAME,
    slug: DEFAULT_TENANT_SLUG,
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    settings: { timezone: 'Asia/Kolkata' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      employee: { updateMany: vi.fn().mockResolvedValue({ count: 5 }) },
      customer: { updateMany: vi.fn().mockResolvedValue({ count: 10 }) },
      lead: { updateMany: vi.fn().mockResolvedValue({ count: 20 }) },
      call: { updateMany: vi.fn().mockResolvedValue({ count: 30 }) },
      crop: { updateMany: vi.fn().mockResolvedValue({ count: 40 }) },
    };
    tenantService = new TenantService(prisma);
    tenantController = new TenantController(tenantService);
  });

  describe('TenantService', () => {
    it('returns existing default tenant if one exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      const result = await tenantService.getOrCreateDefaultTenant();
      expect(result).toEqual(mockTenant);
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('creates default tenant and triggers record backfill if default does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(mockTenant);

      const result = await tenantService.getOrCreateDefaultTenant();
      expect(result).toEqual(mockTenant);
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: DEFAULT_TENANT_SLUG,
            name: DEFAULT_TENANT_NAME,
          }),
        })
      );
      expect(prisma.employee.updateMany).toHaveBeenCalledWith({
        where: { tenantId: null },
        data: { tenantId: mockTenant.id },
      });
      expect(prisma.customer.updateMany).toHaveBeenCalled();
    });

    it('retrieves current tenant by id or slug if found', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      const result = await tenantService.getCurrentTenant('grotec');
      expect(result).toEqual(mockTenant);
    });

    it('falls back to default tenant if specified tenant identifier is not found', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      const result = await tenantService.getCurrentTenant('non-existent-tenant');
      expect(result).toEqual(mockTenant);
    });

    it('prevents duplicate slug creation with conflict error', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      await expect(
        tenantService.createTenant({ name: 'Dup', slug: 'grotec' })
      ).rejects.toThrow(ApiError);
    });

    it('creates new tenant when slug is unique', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      const newTenant = { ...mockTenant, id: 'tenant-2', slug: 'agro-farm', name: 'Agro Farm' };
      prisma.tenant.create.mockResolvedValue(newTenant);

      const result = await tenantService.createTenant({
        name: 'Agro Farm',
        slug: 'agro-farm',
        plan: 'PRO',
      });
      expect(result).toEqual(newTenant);
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Agro Farm',
          slug: 'agro-farm',
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      });
    });
  });

  describe('TenantController', () => {
    it('returns sanitized current tenant without sensitive metadata', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      const res = await tenantController.getCurrentTenant('grotec', undefined);
      expect(res).toEqual({
        id: mockTenant.id,
        name: mockTenant.name,
        slug: mockTenant.slug,
        plan: mockTenant.plan,
        status: mockTenant.status,
        settings: mockTenant.settings,
      });
    });

    it('lists tenants through service', async () => {
      prisma.tenant.findMany.mockResolvedValue([mockTenant]);
      const res = await tenantController.listTenants();
      expect(res).toEqual([mockTenant]);
    });
  });
});
