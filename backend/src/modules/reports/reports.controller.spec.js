import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReportsController } from './reports.controller';

describe('ReportsController (Endpoints, Exports, & Header Setting)', () => {
  let controller;
  let mockService;

  const actor = { id: 'emp-1', roleCode: 'FOUNDER' };

  beforeEach(() => {
    mockService = {
      getCallReport: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      exportCallsCsv: vi.fn().mockResolvedValue({ filename: 'calls.csv', csv: 'header\r\nrow' }),
      getFollowUpReport: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      exportFollowUpsCsv: vi.fn().mockResolvedValue({ filename: 'followups.csv', csv: 'header\r\nrow' }),
      getCustomerReport: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      exportCustomersCsv: vi.fn().mockResolvedValue({ filename: 'customers.csv', csv: 'header\r\nrow' }),
      getLeadReport: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      exportLeadsCsv: vi.fn().mockResolvedValue({ filename: 'leads.csv', csv: 'header\r\nrow' }),
      getLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [], totalAgents: 0 }),
      exportLeaderboardCsv: vi.fn().mockResolvedValue({ filename: 'leaderboard.csv', csv: 'header\r\nrow' }),
    };
    controller = new ReportsController(mockService);
  });

  it('delegates getCalls to service', async () => {
    const query = { status: 'ENDED', page: '1' };
    const res = await controller.getCalls(actor, query);
    expect(mockService.getCallReport).toHaveBeenCalledWith(actor, query);
    expect(res).toEqual({ items: [], total: 0 });
  });

  it('sets Content-Type and Content-Disposition headers on exportCalls', async () => {
    const mockRes = {
      setHeader: vi.fn(),
    };
    const csv = await controller.exportCalls(actor, {}, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="calls.csv"');
    expect(csv).toBe('header\r\nrow');
  });

  it('sets Content-Type and Content-Disposition headers on exportLeaderboard', async () => {
    const mockRes = {
      setHeader: vi.fn(),
    };
    const csv = await controller.exportLeaderboard(actor, { period: 'week' }, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="leaderboard.csv"');
    expect(csv).toBe('header\r\nrow');
  });
});
