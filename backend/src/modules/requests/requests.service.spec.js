import { describe, expect, it, vi } from 'vitest';
import { RequestsService } from './requests.service';

const AGENT = { id: 'agent', roleCode: 'AGENT', tenantId: 't1', fullName: 'Agent' };
const MANAGER = { id: 'mgr', roleCode: 'MANAGER', tenantId: 't1', fullName: 'Manager' };

function fixture({ reportingManagerId = null, managerActive = true, existing = null } = {}) {
  const db = {
    employee: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.id === 'agent') return { id: 'agent', fullName: 'Agent', reportingManagerId, role: { code: 'AGENT' } };
        if (where.id === reportingManagerId && managerActive) return { id: reportingManagerId };
        return null;
      }),
      findMany: vi.fn(async () => [
        { id: 'mgr', role: { code: 'MANAGER' } },
        { id: 'founder', role: { code: 'FOUNDER' } },
        { id: 'staff', role: { code: 'STAFF' } },
        { id: 'gl', role: { code: 'GROUP_LEADER' } },
      ]),
    },
    employeeRequest: {
      create: vi.fn(async ({ data }) => ({ id: 'r1', status: 'OPEN', ...data })),
      findUnique: vi.fn(async () => ({ id: 'r1' })),
      findFirst: vi.fn(async () => existing),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    employeeRequestHistory: { create: vi.fn() },
    appNotification: { create: vi.fn(), createMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
  };
  db.$transaction = (fn) => fn(db);
  return { db, service: new RequestsService(db, { record: vi.fn() }) };
}

describe('RequestsService.create', () => {
  it('routes a manager note to the active reporting manager only', async () => {
    const { db, service } = fixture({ reportingManagerId: 'rm' });
    await service.create(AGENT, { type: 'MANAGER_NOTE', message: 'Need a word' });
    expect(db.employeeRequest.create.mock.calls[0][0].data).toMatchObject({ assigneeId: 'rm', tenantId: 't1', requesterId: 'agent' });
    expect(db.appNotification.createMany.mock.calls[0][0].data.map((n) => n.recipientId)).toEqual(['rm']);
  });

  it('queues other requests for manager-level roles that outrank the requester', async () => {
    const { db, service } = fixture({ reportingManagerId: 'rm' });
    await service.create(AGENT, { type: 'OFFICE_RESOURCE', message: 'Headset broken' });
    expect(db.employeeRequest.create.mock.calls[0][0].data.assigneeId).toBeNull();
    expect(db.appNotification.createMany.mock.calls[0][0].data.map((n) => n.recipientId)).toEqual(['mgr', 'founder', 'gl']);
  });

  it('falls back to the queue when the reporting manager is inactive', async () => {
    const { db, service } = fixture({ reportingManagerId: 'rm', managerActive: false });
    await service.create(AGENT, { type: 'MANAGER_NOTE', message: 'Hello' });
    expect(db.employeeRequest.create.mock.calls[0][0].data.assigneeId).toBeNull();
  });
});

describe('RequestsService.updateStatus', () => {
  const open = { id: 'r1', requesterId: 'agent', type: 'HR_INQUIRY', status: 'OPEN', requester: { fullName: 'Agent' } };

  it('requires a reason to reject', async () => {
    const { service } = fixture({ existing: open });
    await expect(service.updateStatus(MANAGER, 'r1', { status: 'REJECTED' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('refuses to action a closed request', async () => {
    const { service } = fixture({ existing: { ...open, status: 'RESOLVED' } });
    await expect(service.updateStatus(MANAGER, 'r1', { status: 'IN_PROGRESS' })).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
  });

  it('refuses a handler actioning their own request', async () => {
    const { service } = fixture({ existing: { ...open, requesterId: 'mgr' } });
    await expect(service.updateStatus(MANAGER, 'r1', { status: 'RESOLVED' })).rejects.toMatchObject({ code: 'OWN_REQUEST' });
  });

  it('resolves, records history and notifies the requester', async () => {
    const { db, service } = fixture({ existing: open });
    await service.updateStatus(MANAGER, 'r1', { status: 'RESOLVED', note: 'Done' });
    expect(db.employeeRequest.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'r1', status: 'OPEN' }, data: { status: 'RESOLVED', resolutionNote: 'Done' } });
    expect(db.employeeRequestHistory.create.mock.calls[0][0].data).toMatchObject({ fromStatus: 'OPEN', toStatus: 'RESOLVED' });
    expect(db.appNotification.create.mock.calls[0][0].data).toMatchObject({ recipientId: 'agent', type: 'EMPLOYEE_REQUEST_UPDATED' });
  });

  it('reports a concurrent decision instead of overwriting it', async () => {
    const { db, service } = fixture({ existing: open });
    db.employeeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateStatus(MANAGER, 'r1', { status: 'RESOLVED' })).rejects.toMatchObject({ code: 'REQUEST_CHANGED' });
  });

  it('scopes a manager inbox to assigned requests and lower-ranked requesters', () => {
    const { service } = fixture();
    const scope = service.inboxScope(MANAGER);
    const or = scope.AND[1].OR;
    expect(or[0]).toEqual({ assigneeId: 'mgr' });
    expect(or[1].requester.role.code.in).toContain('AGENT');
    expect(or[1].requester.role.code.in).not.toContain('MANAGER');
  });
});
