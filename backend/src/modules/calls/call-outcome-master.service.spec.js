import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CallOutcomeMasterService, DEFAULT_CALL_OUTCOMES } from './call-outcome-master.service';

describe('CallOutcomeMasterService', () => {
  let service;
  let prisma;
  let audit;

  beforeEach(() => {
    prisma = {
      callOutcomeMaster: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
    };
    audit = {
      recordDirect: vi.fn(),
    };
    service = new CallOutcomeMasterService(prisma, audit);
  });

  it('lists active outcomes and auto-bootstraps if table is empty', async () => {
    prisma.callOutcomeMaster.findMany
      .mockResolvedValueOnce([]) // initial empty query
      .mockResolvedValueOnce(DEFAULT_CALL_OUTCOMES); // after bootstrap

    const result = await service.list({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(DEFAULT_CALL_OUTCOMES.length);
    expect(prisma.callOutcomeMaster.upsert).toHaveBeenCalled();
  });

  it('creates new custom call outcome with normalized code', async () => {
    prisma.callOutcomeMaster.findUnique.mockResolvedValue(null);
    prisma.callOutcomeMaster.create.mockImplementation(({ data }) => Promise.resolve({ id: 'out-1', ...data }));

    const created = await service.create({ id: 'emp-1', tenantId: 't-1' }, {
      code: 'sample outcome',
      label: 'Sample Outcome',
      category: 'POSITIVE',
      requiresFollowUp: true,
    });

    expect(created.code).toBe('SAMPLE_OUTCOME');
    expect(created.requiresFollowUp).toBe(true);
    expect(audit.recordDirect).toHaveBeenCalled();
  });

  it('rejects duplicate outcome code creation', async () => {
    prisma.callOutcomeMaster.findUnique.mockResolvedValue({ id: 'existing', code: 'EXISTING' });

    await expect(service.create({ id: 'emp-1' }, { code: 'EXISTING', label: 'Existing' }))
      .rejects.toThrow();
  });

  it('updates outcome properties without mutating historical records', async () => {
    prisma.callOutcomeMaster.findUnique.mockResolvedValue({ id: 'out-1', code: 'INTERESTED', label: 'Interested' });
    prisma.callOutcomeMaster.update.mockResolvedValue({ id: 'out-1', label: 'Very Interested', isActive: true });

    const updated = await service.update('out-1', { id: 'emp-1' }, { label: 'Very Interested' });
    expect(updated.label).toBe('Very Interested');
    expect(audit.recordDirect).toHaveBeenCalled();
  });
});
