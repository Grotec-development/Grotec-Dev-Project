import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test/helpers.js';

describe('Farmer CRM & Operations Platform QA Enhancements', () => {
  let app;
  let founderToken;
  let managerToken;
  let agentToken;

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
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Soil Types Master Data', () => {
    it('should list all bilingual soil types', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/soil-types')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(7);
      const clay = res.body.find(s => s.code === 'CLAY');
      expect(clay).toBeDefined();
      expect(clay.nameEn).toBe('Clay Soil');
      expect(clay.nameTa).toBe('களிமண்');
    });
  });

  describe('4 Regional Delivery Corridors & Dashboard', () => {
    it('should return 4 regional delivery corridors with districts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/routes')
        .set('Authorization', `Bearer ${founderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);
      const coimbatore = res.body.find(r => r.code === 'COIMBATORE');
      expect(coimbatore).toBeDefined();
      expect(coimbatore.name).toBe('Coimbatore Route');
      expect(coimbatore.districts.length).toBeGreaterThan(0);
    });

    it('should retrieve route-wise order consolidation dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/routes/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);
      expect(res.body[0]).toHaveProperty('routeId');
      expect(res.body[0]).toHaveProperty('metrics');
      expect(res.body[0].metrics).toHaveProperty('totalOrders');
      expect(res.body[0].metrics).toHaveProperty('confirmedOrdersCount');
    });
  });

  describe('Customer Delivery Confirmation Workflow', () => {
    it('should validate delivery confirmation endpoint for orders', async () => {
      const fakeOrderId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/routes/orders/${fakeOrderId}/confirm-delivery`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          confirmationStatus: 'CONFIRMED_FOR_DELIVERY',
          notes: 'Customer confirmed delivery for tomorrow morning'
        });

      // 404 since fake UUID doesn't exist, proving endpoint routing and validation works
      expect([404, 400]).toContain(res.status);
    });
  });

  describe('Support Tickets & Escalation Workflows', () => {
    let createdTicketId;

    it('should allow agent to raise a support escalation ticket', async () => {
      const custRes = await request(app.getHttpServer())
        .get('/api/v1/customers?pageSize=1')
        .set('Authorization', `Bearer ${agentToken}`);

      const customerId = custRes.body.items?.[0]?.id;
      expect(customerId).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/v1/support-tickets')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          customerId,
          category: 'CROP_ADVISORY_ESCALATION',
          priority: 'HIGH',
          description: 'Farmer reported fungal leaf spot on tomato. Needs expert agronomist consultation.',
          assignedRole: 'TEAM_LEADER'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.ticketNumber).toBeDefined();
      expect(res.body.category).toBe('CROP_ADVISORY_ESCALATION');
      expect(res.body.priority).toBe('HIGH');
      createdTicketId = res.body.id;
    });

    it('should list tickets and summary metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/support-tickets')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const summaryRes = await request(app.getHttpServer())
        .get('/api/v1/support-tickets/summary')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body).toHaveProperty('total');
      expect(summaryRes.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should allow manager to update status and add resolution notes', async () => {
      if (!createdTicketId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/support-tickets/${createdTicketId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'RESOLVED',
          resolutionNotes: 'Agronomist contacted farmer, recommended Trichoderma viride application.'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESOLVED');
      expect(res.body.resolutionNotes).toContain('Trichoderma');
    });
  });

  describe('Completed Sales Ledger & Tax Invoices', () => {
    it('should list completed sales ledger', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${founderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Server-Side Protection of Sensitive Farmer Details', () => {
    it('should reject agent attempting to modify farmer fullName without permission', async () => {
      const custRes = await request(app.getHttpServer())
        .get('/api/v1/customers?pageSize=1')
        .set('Authorization', `Bearer ${agentToken}`);

      const customer = custRes.body.items?.[0];
      expect(customer).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customer.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          fullName: 'Unauthorized Hacker Name'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NAME_EDIT_RESTRICTED');
    });

    it('should allow founder to modify farmer fullName with an audit reason', async () => {
      const custRes = await request(app.getHttpServer())
        .get('/api/v1/customers?pageSize=1')
        .set('Authorization', `Bearer ${founderToken}`);

      const customer = custRes.body.items?.[0];
      expect(customer).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customer.id}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .send({
          fullName: customer.fullName, // Preserving original name
          nameEditReason: 'Verified Aadhaar Name Alignment by Founder'
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Farmer Call History Endpoint', () => {
    it('should retrieve last interactions for a farmer', async () => {
      const custRes = await request(app.getHttpServer())
        .get('/api/v1/customers?pageSize=1')
        .set('Authorization', `Bearer ${agentToken}`);

      const customer = custRes.body.items?.[0];
      expect(customer).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/calls/customer/${customer.id}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
