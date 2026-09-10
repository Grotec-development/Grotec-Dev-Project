import { describe, expect, it, vi } from 'vitest';
import { computeLeadWorkloadPlan } from './lead-balancer.util';
import { LeadsService } from './leads.service';

describe('Telecaller Lead Workload Balancer & Continuity Engine', () => {
  const agent1 = { id: 'agent-1', fullName: 'Agent One', status: 'ACTIVE' };
  const agent2 = { id: 'agent-2', fullName: 'Agent Two', status: 'ACTIVE' };
  const agent3 = { id: 'agent-3', fullName: 'Agent Three', status: 'ACTIVE' };
  const agent4 = { id: 'agent-4', fullName: 'Agent Four', status: 'ACTIVE' };
  const fourAgents = [agent1, agent2, agent3, agent4];

  // Scenario 1: 1000 items / 4 agents => balanced distribution (250 / 250 / 250 / 250)
  it('1. distributes 1,000 unassigned items across 4 agents with perfect 250/250/250/250 balance', () => {
    const leads = Array.from({ length: 1000 }, (_, i) => ({
      id: `lead-${i + 1}`,
      customerId: `cust-${i + 1}`,
      currentOwnerId: null,
    }));

    const plan = computeLeadWorkloadPlan({ agents: fourAgents, leads });

    expect(plan.totalLeadsCount).toBe(1000);
    expect(plan.assignedCount).toBe(1000);
    expect(plan.unassignedCount).toBe(0);
    expect(plan.agentWorkloads['agent-1']).toBe(250);
    expect(plan.agentWorkloads['agent-2']).toBe(250);
    expect(plan.agentWorkloads['agent-3']).toBe(250);
    expect(plan.agentWorkloads['agent-4']).toBe(250);
    expect(plan.deltaAssignments.length).toBe(1000);
  });

  // Scenario 2: 3 items / 2 agents => 2/1 distribution (max delta <= 1)
  it('2. distributes 3 items across 2 agents resulting in a 2/1 workload', () => {
    const twoAgents = [agent1, agent2];
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: null },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: null },
      { id: 'lead-3', customerId: 'cust-3', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: twoAgents, leads });

    expect(plan.assignedCount).toBe(3);
    expect(plan.agentWorkloads['agent-1']).toBe(2);
    expect(plan.agentWorkloads['agent-2']).toBe(1);
    expect(Math.abs(plan.agentWorkloads['agent-1'] - plan.agentWorkloads['agent-2'])).toBeLessThanOrEqual(1);
  });

  // Scenario 3: continuity preserved when previous Agent remains eligible
  it('3. preserves customer continuity when previous Agent remains active and eligible', () => {
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: null },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: null },
    ];

    const callHistory = [
      {
        customerId: 'cust-1',
        agentId: 'agent-2',
        status: 'ENDED',
        connectedAt: new Date('2026-09-01T10:00:00Z'),
        endedAt: new Date('2026-09-01T10:05:00Z'),
      },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads, callHistory });

    const lead1Assignment = plan.assignments.find((a) => a.leadId === 'lead-1');
    expect(lead1Assignment?.targetAgentId).toBe('agent-2');
    expect(lead1Assignment?.reason).toBe('CONTINUITY');
  });

  // Scenario 4: continuity not preserved when previous Agent is inactive
  it('4. routes to least-loaded eligible agent when previous Agent is inactive', () => {
    const inactiveAgent = { id: 'agent-99', fullName: 'Inactive Agent', status: 'INACTIVE' };
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: null },
    ];

    const callHistory = [
      {
        customerId: 'cust-1',
        agentId: 'agent-99',
        status: 'ENDED',
        connectedAt: new Date('2026-09-01T10:00:00Z'),
        endedAt: new Date('2026-09-01T10:05:00Z'),
      },
    ];

    const plan = computeLeadWorkloadPlan({
      agents: [agent1, agent2, inactiveAgent],
      leads,
      callHistory,
    });

    const lead1Assignment = plan.assignments.find((a) => a.leadId === 'lead-1');
    expect(lead1Assignment?.targetAgentId).toBe('agent-1');
    expect(lead1Assignment?.reason).toBe('BALANCED');
  });

  // Scenario 5: deterministic tie-breaking
  it('5. resolves workload ties deterministically across repeated invocations', () => {
    const leads = [
      { id: 'lead-a', customerId: 'cust-a', currentOwnerId: null },
      { id: 'lead-b', customerId: 'cust-b', currentOwnerId: null },
    ];

    const run1 = computeLeadWorkloadPlan({ agents: [agent2, agent1], leads });
    const run2 = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads });

    expect(run1.assignments).toEqual(run2.assignments);
    expect(run1.assignments[0].targetAgentId).toBe('agent-1');
    expect(run1.assignments[1].targetAgentId).toBe('agent-2');
  });

  // Scenario 6: existing active assignments are counted
  it('6. counts existing active assignments toward agent workload when balancing new leads', () => {
    const leads = [
      // Agent 1 already actively holds 2 leads
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: 'agent-1' },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: 'agent-1' },
      // 2 new unassigned leads
      { id: 'lead-3', customerId: 'cust-3', currentOwnerId: null },
      { id: 'lead-4', customerId: 'cust-4', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads });

    // Both new unassigned leads should go to Agent 2 to achieve 2 / 2 balance
    expect(plan.agentWorkloads['agent-1']).toBe(2);
    expect(plan.agentWorkloads['agent-2']).toBe(2);

    const lead3 = plan.assignments.find((a) => a.leadId === 'lead-3');
    const lead4 = plan.assignments.find((a) => a.leadId === 'lead-4');
    expect(lead3?.targetAgentId).toBe('agent-2');
    expect(lead4?.targetAgentId).toBe('agent-2');
  });

  // Scenario 7: pending follow-up ownership remains pinned
  it('7. keeps leads with pending follow-ups pinned to their current owner', () => {
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: 'agent-2', hasPendingFollowUp: true },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads });

    const lead1 = plan.assignments.find((a) => a.leadId === 'lead-1');
    expect(lead1?.targetAgentId).toBe('agent-2');
    expect(lead1?.reason).toBe('PINNED_PENDING_FOLLOWUP');
  });

  // Scenario 8: no wholesale reassignment on repeated invocation
  it('8. produces zero delta assignments on repeated invocation for already balanced leads', () => {
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: 'agent-1' },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: 'agent-2' },
      { id: 'lead-3', customerId: 'cust-3', currentOwnerId: 'agent-3' },
      { id: 'lead-4', customerId: 'cust-4', currentOwnerId: 'agent-4' },
    ];

    const plan = computeLeadWorkloadPlan({ agents: fourAgents, leads });

    expect(plan.deltaAssignments.length).toBe(0);
    expect(plan.agentWorkloads['agent-1']).toBe(1);
    expect(plan.agentWorkloads['agent-2']).toBe(1);
    expect(plan.agentWorkloads['agent-3']).toBe(1);
    expect(plan.agentWorkloads['agent-4']).toBe(1);
  });

  // Scenario 9: unassigned backlog goes to least-loaded Agent
  it('9. directs new unassigned backlog directly to the least-loaded Agent', () => {
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: 'agent-1' },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: 'agent-1' },
      { id: 'lead-3', customerId: 'cust-3', currentOwnerId: 'agent-1' },
      { id: 'lead-new', customerId: 'cust-new', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads });

    const newAssignment = plan.assignments.find((a) => a.leadId === 'lead-new');
    expect(newAssignment?.targetAgentId).toBe('agent-2');
  });

  // Scenario 10: customers without Leads are not silently converted into assignments
  it('10. operates strictly on actual Leads without inventing customer assignments', () => {
    // Only 2 leads exist, even if 10 customers exist in the system
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: null },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [agent1, agent2], leads });

    expect(plan.totalLeadsCount).toBe(2);
    expect(plan.assignments.length).toBe(2);
    expect(plan.assignments.map((a) => a.leadId)).toEqual(['lead-1', 'lead-2']);
  });

  // Scenario 11: no duplicate ownership assignment produced by the algorithm
  it('11. guarantees each lead appears exactly once with no duplicate assignments', () => {
    const leads = Array.from({ length: 50 }, (_, i) => ({
      id: `lead-${i + 1}`,
      customerId: `cust-${i + 1}`,
      currentOwnerId: i % 2 === 0 ? 'agent-1' : null,
    }));

    const plan = computeLeadWorkloadPlan({ agents: fourAgents, leads });

    const seenLeadIds = new Set();
    for (const a of plan.assignments) {
      expect(seenLeadIds.has(a.leadId)).toBe(false);
      seenLeadIds.add(a.leadId);
    }
    expect(seenLeadIds.size).toBe(50);
  });

  // Scenario 12: zero eligible Agents handled safely
  it('12. safely handles zero eligible agents without throwing exceptions', () => {
    const leads = [
      { id: 'lead-1', customerId: 'cust-1', currentOwnerId: null },
      { id: 'lead-2', customerId: 'cust-2', currentOwnerId: null },
    ];

    const plan = computeLeadWorkloadPlan({ agents: [], leads });

    expect(plan.eligibleAgentsCount).toBe(0);
    expect(plan.assignedCount).toBe(0);
    expect(plan.unassignedCount).toBe(2);
    expect(plan.assignments.length).toBe(0);
    expect(plan.deltaAssignments.length).toBe(0);
    expect(plan.reason).toBe('NO_ELIGIBLE_AGENTS');
  });
});

describe('LeadsService rebalanceWorkload integration', () => {
  it('computes plan without executing mutations when dryRun is true', async () => {
    const mockPrisma = {
      employee: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'agent-1', fullName: 'Agent One', status: 'ACTIVE' },
          { id: 'agent-2', fullName: 'Agent Two', status: 'ACTIVE' },
        ]),
      },
      lead: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'lead-1', customerId: 'cust-1', ownerships: [], callSessions: [] },
          { id: 'lead-2', customerId: 'cust-2', ownerships: [], callSessions: [] },
          { id: 'lead-3', customerId: 'cust-3', ownerships: [], callSessions: [] },
        ]),
      },
      callSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(),
    };
    const mockAudit = { record: vi.fn() };
    const mockEvents = { emit: vi.fn() };

    const service = new LeadsService(mockPrisma, mockAudit, mockEvents);
    const result = await service.rebalanceWorkload({ id: 'founder-1', roleCode: 'FOUNDER' }, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.plan.assignedCount).toBe(3);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies delta assignments in transaction when dryRun is false', async () => {
    const mockTx = {
      leadOwnership: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'new-own-1' }),
      },
    };
    const mockPrisma = {
      employee: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'agent-1', fullName: 'Agent One', status: 'ACTIVE' },
        ]),
      },
      lead: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'lead-1', customerId: 'cust-1', ownerships: [], callSessions: [] },
        ]),
      },
      callSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (cb) => cb(mockTx)),
    };
    const mockAudit = { record: vi.fn() };
    const mockEvents = { emit: vi.fn() };

    const service = new LeadsService(mockPrisma, mockAudit, mockEvents);
    const result = await service.rebalanceWorkload({ id: 'founder-1', roleCode: 'FOUNDER' }, { dryRun: false });

    expect(result.dryRun).toBe(false);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockTx.leadOwnership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          employeeId: 'agent-1',
        }),
      })
    );
    expect(mockAudit.record).toHaveBeenCalled();
  });
});

