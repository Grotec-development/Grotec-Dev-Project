import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

function fixture(claimCounts) {
  const due = claimCounts.map((_, i) => ({ id: `f${i}`, agentId: 'agent', customerId: `c${i}`, customer: { fullName: `Farmer ${i}` } }));
  const db = {
    followUp: {
      findMany: vi.fn(async () => due),
      updateMany: vi.fn(async ({ where }) => ({ count: claimCounts[Number(where.id.slice(1))] })),
    },
    appNotification: { create: vi.fn() },
  };
  db.$transaction = (fn) => fn(db);
  return { db, service: new NotificationsService(db) };
}

describe('NotificationsService.processFollowUpReminders', () => {
  it('sends one reminder per follow-up it claims', async () => {
    const { db, service } = fixture([1, 1]);
    await expect(service.processFollowUpReminders()).resolves.toEqual({ sent: 2 });
    expect(db.appNotification.create).toHaveBeenCalledTimes(2);
  });

  it('skips follow-ups another run already claimed', async () => {
    const { db, service } = fixture([0, 1]);
    await expect(service.processFollowUpReminders()).resolves.toEqual({ sent: 1 });
    expect(db.appNotification.create).toHaveBeenCalledTimes(1);
    expect(db.appNotification.create.mock.calls[0][0].data.data.followUpId).toBe('f1');
  });
});
