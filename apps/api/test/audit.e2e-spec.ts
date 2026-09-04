import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, USERS } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('audit', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let founderToken: string;
  let agentToken: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    founderToken = await loginToken(app, USERS.FOUNDER);
    agentToken = await loginToken(app, USERS.AGENT);
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records customer creation with the actor and before/after context', async () => {
    const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
    const customerId = await createCustomerAs(app, agentToken, 'Audited Farmer', '9876545001');

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit?entityType=CUSTOMER')
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200);
    const body = res.body as {
      items: Array<{ entityId: string; action: string; actor: { id: string } | null; after: { phones: string[] } }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const event = body.items.find((e) => e.entityId === customerId);
    expect(event?.action).toBe('created');
    expect(event?.actor?.id).toBe(agentId);
    expect(event?.after?.phones).toContain('+919876545001');
  });

  it('records login success and failure events', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: USERS.AGENT.email, password: 'wrong-password-9' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: USERS.AGENT.email, password: USERS.AGENT.password })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit?entityType=AUTH')
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200);
    const actions = (res.body as { items: Array<{ action: string }> }).items.map((e) => e.action);
    expect(actions).toContain('login.failed');
    expect(actions).toContain('login.success');
  });

  it('records ownership assignment on lead handover', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'Ownership Audit', '9876545002');
    const lead = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ customerId, source: 'TEST' })
      .expect(201);
    const leadId = (lead.body as { id: string }).id;

    const managerToken = await loginToken(app, USERS.MANAGER);
    const founderId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } })).id;
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: founderId, reason: 'escalation' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit?entityType=LEAD&entityId=${leadId}`)
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200);
    const actions = (res.body as { items: Array<{ action: string; after: { ownerId: string } }> }).items;
    const assignment = actions.find((e) => e.action === 'ownership.assigned');
    expect(assignment?.after.ownerId).toBe(founderId);
  });
});
