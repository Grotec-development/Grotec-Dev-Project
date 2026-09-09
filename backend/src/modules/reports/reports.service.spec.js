import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReportsService } from './reports.service';

describe('ReportsService (Filters, RBAC Scoping, & Deterministic Leaderboard)', () => {
  let service;
  let mockPrisma;

  const founderActor = { id: 'founder-1', roleCode: 'FOUNDER' };
  const managerActor = { id: 'manager-1', roleCode: 'MANAGER' };
  const agentActor = { id: 'agent-1', roleCode: 'AGENT' };

  beforeEach(() => {
    mockPrisma = {
      call: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      followUp: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      customer: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      lead: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      employee: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      relationshipOwnership: {
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new ReportsService(mockPrisma);
  });

  describe('Call Activity Report Scoping', () => {
    it('restricts AGENT strictly to own agentId regardless of query params', async () => {
      await service.getCallReport(agentActor, { agentId: 'other-agent-99', status: 'ENDED' });

      expect(mockPrisma.call.findMany).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.call.findMany.mock.calls[0][0];
      expect(callArgs.where.agentId).toBe('agent-1');
      expect(callArgs.where.status).toBe('ENDED');
    });

    it('allows MANAGER to filter by specific agentId or view team-wide', async () => {
      await service.getCallReport(managerActor, { agentId: 'agent-42' });
      expect(mockPrisma.call.findMany.mock.calls[0][0].where.agentId).toBe('agent-42');

      await service.getCallReport(founderActor, {});
      expect(mockPrisma.call.findMany.mock.calls[1][0].where.agentId).toBeUndefined();
    });

    it('validates date range and throws for invalid startDate or endDate', async () => {
      await expect(
        service.getCallReport(founderActor, { startDate: 'invalid-date' })
      ).rejects.toThrow(/startDate must be a valid/);

      await expect(
        service.getCallReport(founderActor, { startDate: '2026-09-10', endDate: '2026-09-01' })
      ).rejects.toThrow(/startDate must not be later than endDate/);
    });

    it('computes call duration in seconds accurately', () => {
      const call = {
        connectedAt: new Date('2026-09-09T10:00:00.000Z'),
        endedAt: new Date('2026-09-09T10:02:45.000Z'),
      };
      expect(service.formatCallDuration(call)).toBe(165);
      expect(service.formatCallDuration({ connectedAt: null, endedAt: null })).toBe(0);
    });
  });

  describe('Follow-Up Discipline Report Scoping', () => {
    it('restricts AGENT to own follow-ups', async () => {
      await service.getFollowUpReport(agentActor, {});
      expect(mockPrisma.followUp.findMany.mock.calls[0][0].where.agentId).toBe('agent-1');
    });

    it('handles overdue filter accurately', async () => {
      await service.getFollowUpReport(managerActor, { overdue: 'true' });
      const where = mockPrisma.followUp.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
      expect(where.dueAt.lt).toBeInstanceOf(Date);
    });
  });

  describe('Leaderboard Aggregation & Deterministic Tie-Breaking', () => {
    it('calculates operational metrics and ranks agents with deterministic tie-breaking', async () => {
      const mockAgents = [
        { id: 'agent-A', employeeCode: 'EMP002', fullName: 'Agent A', department: 'Telecalling', role: { code: 'AGENT' } },
        { id: 'agent-B', employeeCode: 'EMP001', fullName: 'Agent B', department: 'Telecalling', role: { code: 'AGENT' } },
        { id: 'agent-C', employeeCode: 'EMP003', fullName: 'Agent C', department: 'Telecalling', role: { code: 'AGENT' } },
      ];
      mockPrisma.employee.findMany.mockResolvedValue(mockAgents);

      // Agent A: 10 calls (8 connected, 800s talk time), 5 followups completed, 2 conversions
      // Agent B: 12 calls (8 connected, 900s talk time), 5 followups completed, 2 conversions -> TIE with A on connected & conversions & followups, wins on talk time!
      // Agent C: 15 calls (5 connected, 500s talk time), 8 followups, 1 conversion -> lower connected calls
      mockPrisma.call.findMany.mockImplementation(({ where }) => {
        if (where.agentId === 'agent-A') {
          return Promise.resolve(new Array(8).fill({
            status: 'ENDED',
            connectedAt: new Date('2026-09-01T10:00:00Z'),
            endedAt: new Date('2026-09-01T10:01:40Z'), // 100s each = 800s
          }));
        }
        if (where.agentId === 'agent-B') {
          return Promise.resolve(new Array(8).fill({
            status: 'ENDED',
            connectedAt: new Date('2026-09-01T10:00:00Z'),
            endedAt: new Date('2026-09-01T10:01:52Z'), // 112.5s each = 900s
          }));
        }
        if (where.agentId === 'agent-C') {
          return Promise.resolve(new Array(5).fill({
            status: 'CONNECTED',
            connectedAt: new Date('2026-09-01T10:00:00Z'),
            endedAt: new Date('2026-09-01T10:01:40Z'), // 100s each = 500s
          }));
        }
        return Promise.resolve([]);
      });

      mockPrisma.relationshipOwnership.count.mockImplementation(({ where }) => {
        if (where.assignedById === 'agent-A') return Promise.resolve(2);
        if (where.assignedById === 'agent-B') return Promise.resolve(2);
        if (where.assignedById === 'agent-C') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      mockPrisma.followUp.count.mockImplementation(({ where }) => {
        if (where.status === 'COMPLETED') {
          if (where.agentId === 'agent-A') return Promise.resolve(5);
          if (where.agentId === 'agent-B') return Promise.resolve(5);
          if (where.agentId === 'agent-C') return Promise.resolve(8);
        }
        return Promise.resolve(1);
      });

      const result = await service.getLeaderboard(agentActor, { period: 'month' });

      expect(result.totalAgents).toBe(3);
      expect(result.leaderboard[0].agentId).toBe('agent-B'); // Rank 1: 8 connected, 2 conv, 5 fu, 900s talk time
      expect(result.leaderboard[0].rank).toBe(1);
      expect(result.leaderboard[1].agentId).toBe('agent-A'); // Rank 2: 8 connected, 2 conv, 5 fu, 800s talk time
      expect(result.leaderboard[1].rank).toBe(2);
      expect(result.leaderboard[2].agentId).toBe('agent-C'); // Rank 3: 5 connected
      expect(result.leaderboard[2].rank).toBe(3);

      // Verify isCurrentAgent marker
      expect(result.leaderboard.find((a) => a.agentId === 'agent-A').isCurrentAgent).toBe(false);
      expect(result.currentAgentRank).toBeNull(); // agentActor is 'agent-1', not in this mock list
    });

    it('blocks non-management from exporting leaderboard CSV', async () => {
      await expect(
        service.exportLeaderboardCsv(agentActor, {})
      ).rejects.toThrow(/Leaderboard export is restricted to management/);
    });

    it('allows FOUNDER and MANAGER to export leaderboard CSV', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      const result = await service.exportLeaderboardCsv(founderActor, {});
      expect(result.filename).toMatch(/grotec_leaderboard_/);
      expect(result.csv).toContain('Rank,Employee Code,Agent Name');
    });
  });
});
