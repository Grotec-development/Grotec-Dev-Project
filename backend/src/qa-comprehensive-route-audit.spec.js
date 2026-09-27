import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test/helpers.js';

describe('Comprehensive Full Site QA Route Audit', () => {
  let app;
  let founderToken;
  let managerToken;
  let agentToken;
  let driverToken;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;

    async function login(email, password) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password });
      if (res.status !== 200 || !res.body.accessToken) {
        throw new Error(`Login failed for ${email} (status: ${res.status}): ${JSON.stringify(res.body)}`);
      }
      return res.body.accessToken;
    }

    founderToken = await login('founder@grotec.local', 'Founder@Grotec2026!');
    managerToken = await login('manager@grotec.local', 'Manager@Grotec2026!');
    agentToken = await login('agent_1@grotec.local', 'Agent1@Grotec2026!');
    driverToken = await login('delivery@grotec.local', 'Driver@Grotec2026!');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const routes = [
    // Core Dashboard & CRM
    { path: '/api/v1/health', token: null, name: 'Health Check' },
    { path: '/api/v1/dashboard/summary', token: () => founderToken, name: 'Dashboard Summary (Founder)' },
    { path: '/api/v1/dashboard/summary', token: () => agentToken, name: 'Dashboard Summary (Agent)' },
    { path: '/api/v1/customers?pageSize=10', token: () => founderToken, name: 'Customers List (Founder - 5011)' },
    { path: '/api/v1/customers?pageSize=10', token: () => agentToken, name: 'Customers List (Agent 1 - Scoped)' },
    { path: '/api/v1/calls/queue', token: () => agentToken, name: 'Calls Queue (Agent 1)' },
    { path: '/api/v1/relationship/roster', token: () => founderToken, name: 'Relationship Roster (Founder)' },
    { path: '/api/v1/relationship/holders', token: () => founderToken, name: 'Relationship Holders (Founder)' },
    { path: '/api/v1/relationship/unassigned', token: () => founderToken, name: 'Relationship Unassigned (Founder)' },
    { path: '/api/v1/leads?pageSize=10', token: () => founderToken, name: 'Leads List (Founder)' },
    { path: '/api/v1/crops', token: () => founderToken, name: 'Crops Catalog' },
    { path: '/api/v1/assistant/guidance', token: () => founderToken, name: 'Knowledge Base Guidance' },
    { path: '/api/v1/reports/agent-performance?period=today', token: () => founderToken, name: 'Agent Performance Report' },

    // Supply Chain, Delivery & Factory
    { path: '/api/v1/orders', token: () => founderToken, name: 'Orders List (Founder)' },
    { path: '/api/v1/products', token: () => founderToken, name: 'Products Catalog' },
    { path: '/api/v1/inventory/stocks', token: () => founderToken, name: 'Inventory Stocks' },
    { path: '/api/v1/inventory/movements', token: () => founderToken, name: 'Inventory Movements' },
    { path: '/api/v1/production/batches', token: () => founderToken, name: 'Production Batches' },
    { path: '/api/v1/dispatch/trips', token: () => founderToken, name: 'Dispatch Trips' },
    { path: '/api/v1/dispatch/vehicles', token: () => founderToken, name: 'Dispatch Vehicles' },
    { path: '/api/v1/delivery/active-trip', token: () => driverToken, name: 'Delivery Active Trip (Driver)' },
    { path: '/api/v1/exceptions/pending', token: () => founderToken, name: 'Pending Exceptions' },

    // HRMS & People Operations
    { path: '/api/v1/hrms/dashboard', token: () => founderToken, name: 'HRMS Dashboard (Founder)' },
    { path: '/api/v1/employees?pageSize=10', token: () => founderToken, name: 'Employees List' },
    { path: '/api/v1/roles', token: () => founderToken, name: 'Roles List' },
    { path: '/api/v1/permissions', token: () => founderToken, name: 'Permissions List' },
    { path: '/api/v1/attendance', token: () => founderToken, name: 'Team Attendance (Founder)' },
    { path: '/api/v1/attendance/summary', token: () => founderToken, name: 'Attendance Summary' },
    { path: '/api/v1/attendance/my', token: () => agentToken, name: 'My Attendance (Agent)' },
    { path: '/api/v1/attendance/my/summary', token: () => agentToken, name: 'My Attendance Summary (Agent)' },
    { path: '/api/v1/leave/types', token: () => agentToken, name: 'Leave Types' },
    { path: '/api/v1/leave/my/balances', token: () => agentToken, name: 'My Leave Balances (Agent)' },
    { path: '/api/v1/leave/my/applications', token: () => agentToken, name: 'My Leave Applications (Agent)' },
    { path: '/api/v1/leave/balances', token: () => managerToken, name: 'Team Leave Balances (Manager)' },
    { path: '/api/v1/leave/applications', token: () => managerToken, name: 'Team Leave Applications (Manager)' },
    { path: '/api/v1/payroll/runs', token: () => founderToken, name: 'Payroll Runs' },
    { path: '/api/v1/payroll/advances', token: () => founderToken, name: 'Payroll Advances' },
    { path: '/api/v1/payroll/payslips', token: () => agentToken, name: 'My Payslips (Agent)' },
    { path: '/api/v1/kpi/targets', token: () => founderToken, name: 'KPI Targets' },
    { path: '/api/v1/kpi/team-summary/2026-09', token: () => managerToken, name: 'KPI Team Summary (Manager)' },
    { path: '/api/v1/kpi/my/score/2026-09', token: () => agentToken, name: 'My KPI Score (Agent)' },

    // Action Center, Notifications & Audit
    { path: '/api/v1/requests/my', token: () => agentToken, name: 'My Requests (Agent)' },
    { path: '/api/v1/requests/team', token: () => managerToken, name: 'Team Requests (Manager)' },
    { path: '/api/v1/notifications/unread-count', token: () => agentToken, name: 'Unread Notifications Count' },
    { path: '/api/v1/notifications', token: () => agentToken, name: 'Notifications List' },
    { path: '/api/v1/audit', token: () => founderToken, name: 'Audit Log (Founder)' },
  ];

  for (const r of routes) {
    it(`should successfully resolve 2xx for: ${r.name} (${r.path})`, async () => {
      const req = request(app.getHttpServer()).get(r.path);
      const t = typeof r.token === 'function' ? r.token() : r.token;
      if (t) {
        req.set('Authorization', `Bearer ${t}`);
      }
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body).toBeDefined();
    });
  }
});
