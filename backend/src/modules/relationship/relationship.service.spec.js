import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PERMISSIONS, PROPOSED_ROLE_PERMISSIONS } from '@grotec/shared';
import { RelationshipService } from './relationship.service';
import { CustomersService } from '../customers/customers.service';

/**
 * Database-free authorization tests for the RM workspace.
 *
 * The point of these is the WHERE clause the service hands Prisma: an AGENT must
 * never be able to ask for relationship rows outside the customers they are
 * already allowed to see, and FOUNDER / MANAGER scoping must be unchanged.
 */
describe('RelationshipService — role scoping', () => {
  let service;
  let mockPrisma;
  // The real CustomersService.visibilityWhere is used (not a stub) so this test
  // fails if that single source of the agent visibility rule ever drifts.
  const customers = new CustomersService();

  const AGENT = { id: 'emp-agent-1', roleCode: 'AGENT', permissions: PROPOSED_ROLE_PERMISSIONS.AGENT };
  const OTHER_AGENT_ID = 'emp-agent-2';
  const MANAGER = { id: 'emp-mgr-1', roleCode: 'MANAGER', permissions: PROPOSED_ROLE_PERMISSIONS.MANAGER };
  const FOUNDER = { id: 'emp-founder-1', roleCode: 'FOUNDER', permissions: PROPOSED_ROLE_PERMISSIONS.FOUNDER };

  beforeEach(() => {
    mockPrisma = {
      relationshipOwnership: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-mgr', code: 'MANAGER' }) },
      employee: {
        findMany: vi.fn().mockResolvedValue([{ id: 'emp-mgr-1', fullName: 'Manager One', email: 'm1@grotec.local' }]),
      },
    };
    service = new RelationshipService(mockPrisma, {}, {}, customers);
  });

  const whereFrom = () => mockPrisma.relationshipOwnership.findMany.mock.calls[0][0].where;

  it('constrains an AGENT to customers created by them or holding a lead they own', async () => {
    await service.list(AGENT, {});
    const scope = whereFrom().customer.is.AND[0];

    expect(scope.OR).toEqual([
      { createdById: AGENT.id },
      {
        leads: {
          some: { deletedAt: null, ownerships: { some: { employeeId: AGENT.id, releasedAt: null } } },
        },
      },
    ]);
  });

  it('never scopes an AGENT to another agent’s ownership', async () => {
    await service.list(AGENT, {});
    const serialized = JSON.stringify(whereFrom());

    expect(serialized).toContain(AGENT.id);
    expect(serialized).not.toContain(OTHER_AGENT_ID);
  });

  it('does not let an AGENT widen the query with an rmId filter', async () => {
    await service.list(AGENT, { rmId: 'emp-mgr-1' });
    const where = whereFrom();

    // rmId only narrows which RM's rows are returned; the customer-level agent
    // scope is still applied on top of it, so no unowned customer can leak.
    expect(where.customer.is.AND[0].OR).toBeDefined();
  });

  it('refuses the unassigned queue for an AGENT', async () => {
    await expect(service.list(AGENT, { unassigned: '1' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('leaves MANAGER pinned to their own portfolio with no customer-level narrowing', async () => {
    await service.list(MANAGER, {});
    const where = whereFrom();

    expect(where.employeeId).toBe(MANAGER.id);
    expect(where.customer.is.AND).toEqual([{}]);
  });

  it('rejects a MANAGER asking for a different RM’s portfolio', async () => {
    await expect(service.list(MANAGER, { rmId: 'emp-mgr-2' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('leaves FOUNDER unscoped across the whole portfolio', async () => {
    await service.list(FOUNDER, {});
    const where = whereFrom();

    expect(where.employeeId).toBeUndefined();
    expect(where.customer.is.AND).toEqual([{}]);
  });
});

describe('RelationshipService — holder visibility', () => {
  let service;
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = {
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-mgr', code: 'MANAGER' }) },
      employee: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'emp-mgr-1', fullName: 'Manager One', email: 'm1@grotec.local' },
          { id: 'emp-mgr-2', fullName: 'Manager Two', email: 'm2@grotec.local' },
        ]),
      },
      relationshipOwnership: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    service = new RelationshipService(mockPrisma, {}, {}, new CustomersService());
  });

  it('returns no holders to an AGENT and does not query the employee table', async () => {
    const holders = await service.holders({ id: 'emp-agent-1', roleCode: 'AGENT' });

    expect(holders).toEqual([]);
    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('still returns the holder roster to FOUNDER', async () => {
    const holders = await service.holders({ id: 'emp-founder-1', roleCode: 'FOUNDER' });

    expect(holders).toHaveLength(2);
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
  });

  it('still returns the holder roster to MANAGER', async () => {
    const holders = await service.holders({ id: 'emp-mgr-1', roleCode: 'MANAGER' });

    expect(holders).toHaveLength(2);
  });
});

describe('RelationshipService — permission matrix backing the guards', () => {
  it('grants AGENT read but withholds relationship management', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).toContain(PERMISSIONS.relationshipRead);
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).not.toContain(PERMISSIONS.relationshipManage);
  });

  it('keeps STAFF and DELIVERY out of the relationship module entirely', () => {
    for (const role of ['STAFF', 'DELIVERY']) {
      expect(PROPOSED_ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.relationshipRead);
      expect(PROPOSED_ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.relationshipManage);
    }
  });
});
