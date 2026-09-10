/**
 * Deterministic Telecaller Load Balancing & Continuity Engine
 *
 * Implements strict rules:
 * 1. Continuity Preservation:
 *    A customer with a prior meaningful completed call (status === 'ENDED' && connectedAt != null)
 *    remains pinned to that same Agent, provided the Agent is active and eligible.
 * 2. Active Ownership Pinning (No Churn):
 *    Active leads already assigned to eligible agents, or with pending follow-ups, or worked
 *    in the current shift, remain with their current holder.
 * 3. Greedy Least-Loaded Workload Balancing:
 *    Remaining unassigned leads are distributed one-by-one to the eligible agent with the
 *    minimum current workload.
 * 4. Deterministic Tie-Breaking:
 *    Ties are broken deterministically by stable agent identifier (employee.id).
 * 5. Non-Eligible / Zero-Agent Safety:
 *    Zero eligible agents returns a safe no-op plan.
 */

export function computeLeadWorkloadPlan({
  agents = [],
  leads = [],
  callHistory = [],
  options = {},
}) {
  const preserveExisting = options.preserveExistingAssignments ?? true;

  // 1. Guard against zero eligible agents
  const eligibleAgents = agents
    .filter((a) => a && (!a.status || a.status === 'ACTIVE'))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (eligibleAgents.length === 0) {
    return {
      eligibleAgentsCount: 0,
      totalLeadsCount: leads.length,
      assignedCount: 0,
      unassignedCount: leads.length,
      agentWorkloads: {},
      assignments: [],
      deltaAssignments: [],
      reason: 'NO_ELIGIBLE_AGENTS',
    };
  }

  const eligibleAgentIds = new Set(eligibleAgents.map((a) => a.id));

  // 2. Initialize workloads and assignment maps
  const workloads = new Map();
  const assignmentsByLeadId = new Map();
  for (const agent of eligibleAgents) {
    workloads.set(agent.id, 0);
  }

  // 3. Build lookup for most recent completed meaningful call per customer
  // status === 'ENDED' && connectedAt != null, ordered by endedAt desc
  const lastMeaningfulAgentByCustomer = new Map();
  if (Array.isArray(callHistory)) {
    const sortedCalls = [...callHistory].sort(
      (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
    );
    for (const call of sortedCalls) {
      if (
        call.customerId &&
        call.agentId &&
        call.status === 'ENDED' &&
        call.connectedAt != null &&
        !lastMeaningfulAgentByCustomer.has(call.customerId)
      ) {
        lastMeaningfulAgentByCustomer.set(call.customerId, call.agentId);
      }
    }
  } else if (callHistory instanceof Map) {
    for (const [custId, val] of callHistory.entries()) {
      const agentId = typeof val === 'string' ? val : val.agentId;
      lastMeaningfulAgentByCustomer.set(custId, agentId);
    }
  }

  const unhandledLeads = [];

  // 4. Pass 1: Pin active assignments & pending follow-ups (No Churn)
  for (const lead of leads) {
    const currentOwner = lead.currentOwnerId;
    const isCurrentOwnerEligible = Boolean(currentOwner && eligibleAgentIds.has(currentOwner));

    // Rule A: Pending follow-ups MUST remain pinned to their current owner if eligible
    if (lead.hasPendingFollowUp && isCurrentOwnerEligible) {
      workloads.set(currentOwner, workloads.get(currentOwner) + 1);
      assignmentsByLeadId.set(lead.id, {
        leadId: lead.id,
        customerId: lead.customerId,
        targetAgentId: currentOwner,
        previousOwnerId: currentOwner,
        reason: 'PINNED_PENDING_FOLLOWUP',
      });
      continue;
    }

    // Rule B: Leads worked in current shift remain with current owner
    if (lead.workedInCurrentShift && isCurrentOwnerEligible) {
      workloads.set(currentOwner, workloads.get(currentOwner) + 1);
      assignmentsByLeadId.set(lead.id, {
        leadId: lead.id,
        customerId: lead.customerId,
        targetAgentId: currentOwner,
        previousOwnerId: currentOwner,
        reason: 'PINNED_CURRENT_SHIFT',
      });
      continue;
    }

    // Rule C: Existing active assignments remain pinned if preserveExisting is true
    if (preserveExisting && isCurrentOwnerEligible) {
      workloads.set(currentOwner, workloads.get(currentOwner) + 1);
      assignmentsByLeadId.set(lead.id, {
        leadId: lead.id,
        customerId: lead.customerId,
        targetAgentId: currentOwner,
        previousOwnerId: currentOwner,
        reason: 'PRESERVED_ACTIVE_OWNERSHIP',
      });
      continue;
    }

    // Lead needs assignment or reassignment (e.g. unassigned or owner is inactive/unavailable)
    unhandledLeads.push(lead);
  }

  // 5. Pass 2: Continuity Rule
  // Prior meaningful conversation with an active eligible Agent takes precedence
  const remainingLeads = [];
  for (const lead of unhandledLeads) {
    const previousMeaningfulAgentId = lastMeaningfulAgentByCustomer.get(lead.customerId);
    if (previousMeaningfulAgentId && eligibleAgentIds.has(previousMeaningfulAgentId)) {
      workloads.set(previousMeaningfulAgentId, workloads.get(previousMeaningfulAgentId) + 1);
      assignmentsByLeadId.set(lead.id, {
        leadId: lead.id,
        customerId: lead.customerId,
        targetAgentId: previousMeaningfulAgentId,
        previousOwnerId: lead.currentOwnerId || null,
        reason: 'CONTINUITY',
      });
    } else {
      remainingLeads.push(lead);
    }
  }

  // 6. Pass 3: Greedy Least-Loaded Allocation for remaining unassigned leads
  function getLeastLoadedAgentId() {
    let minCount = Infinity;
    let selectedId = eligibleAgents[0].id;
    for (const agent of eligibleAgents) {
      const count = workloads.get(agent.id);
      if (count < minCount) {
        minCount = count;
        selectedId = agent.id;
      }
      // Ties preserve first sorted agent
    }
    return selectedId;
  }

  for (const lead of remainingLeads) {
    const targetAgentId = getLeastLoadedAgentId();
    workloads.set(targetAgentId, workloads.get(targetAgentId) + 1);
    assignmentsByLeadId.set(lead.id, {
      leadId: lead.id,
      customerId: lead.customerId,
      targetAgentId,
      previousOwnerId: lead.currentOwnerId || null,
      reason: 'BALANCED',
    });
  }

  // 7. Compile final plan and delta
  const allAssignments = Array.from(assignmentsByLeadId.values());
  const deltaAssignments = allAssignments.filter(
    (a) => a.targetAgentId !== a.previousOwnerId
  );

  const agentWorkloads = {};
  for (const [agentId, count] of workloads.entries()) {
    agentWorkloads[agentId] = count;
  }

  return {
    eligibleAgentsCount: eligibleAgents.length,
    totalLeadsCount: leads.length,
    assignedCount: allAssignments.length,
    unassignedCount: leads.length - allAssignments.length,
    agentWorkloads,
    assignments: allAssignments,
    deltaAssignments,
    reason: 'SUCCESS',
  };
}
