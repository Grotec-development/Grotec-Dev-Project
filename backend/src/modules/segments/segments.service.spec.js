import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SegmentsService } from './segments.service';

describe('SegmentsService', () => {
  let service;
  let prisma;
  let audit;

  beforeEach(() => {
    prisma = {
      customer: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      farmerSegment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    audit = {
      recordDirect: vi.fn(),
    };
    service = new SegmentsService(prisma, audit);
  });

  it('queries dynamic farmer segment matching crops and district', async () => {
    prisma.customer.count.mockResolvedValue(12);
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'cust-1',
        fullName: 'Murugan K',
        farmerCode: 'GF00000001',
        status: 'ACTIVE',
        phones: [{ phoneE164: '+919442188231', isPrimary: true }],
        locations: [{ district: 'Madurai', taluk: 'Melur', village: 'Attapatti' }],
        crops: [{ crop: { name: 'Paddy' } }],
        relationshipOwnership: [{ employee: { fullName: 'M. Anand' } }],
      },
    ]);

    const result = await service.querySegment({ id: 'emp-1' }, { district: 'Madurai', cropName: 'Paddy' });
    expect(result.totalMatching).toBe(12);
    expect(result.farmers).toHaveLength(1);
    expect(result.farmers[0].district).toBe('Madurai');
    expect(result.farmers[0].crops).toBe('Paddy');
  });

  it('saves dynamic segment and records audit', async () => {
    prisma.farmerSegment.create.mockResolvedValue({
      id: 'seg-1',
      name: 'Madurai Paddy Farmers',
      filterCriteria: { district: 'Madurai' },
    });

    const saved = await service.saveSegment(
      { id: 'emp-1', tenantId: 't-1' },
      { name: 'Madurai Paddy Farmers', filterCriteria: { district: 'Madurai' } },
    );

    expect(saved.id).toBe('seg-1');
    expect(audit.recordDirect).toHaveBeenCalled();
  });

  it('previews campaign with approved template and opt-in compliance', async () => {
    prisma.farmerSegment.findUnique.mockResolvedValue({
      id: 'seg-1',
      name: 'Madurai Paddy Farmers',
      filterCriteria: { district: 'Madurai' },
    });
    prisma.customer.count.mockResolvedValue(45);

    const preview = await service.previewCampaign({ id: 'emp-1' }, 'seg-1', {
      templateId: 'TPL_SEASONAL_BIO_FERT',
    });

    expect(preview.segmentName).toBe('Madurai Paddy Farmers');
    expect(preview.totalEligibleFarmers).toBe(45);
    expect(preview.communicationProviderReady).toBe(true);
    expect(preview.sampleMessage).toContain('Bio Jeevan');
  });
});
