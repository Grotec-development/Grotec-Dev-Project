import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginToken, resetData, uniqueEmail, USERS } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('rbac', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks an agent from reading the audit log (403)', async () => {
    const agent = await loginToken(app, USERS.AGENT);
    const res = await request(app.getHttpServer()).get('/api/v1/audit').set('Authorization', `Bearer ${agent}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows founder but not manager to read the audit log (PRD §5.2)', async () => {
    const founder = await loginToken(app, USERS.FOUNDER);
    const manager = await loginToken(app, USERS.MANAGER);
    await request(app.getHttpServer()).get('/api/v1/audit').set('Authorization', `Bearer ${founder}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/audit').set('Authorization', `Bearer ${manager}`).expect(403);
  });

  it('gives staff (HRMS/payroll role) no CRM access in Phase 1 (PRD §5.2)', async () => {
    const staff = await loginToken(app, USERS.STAFF);
    await request(app.getHttpServer()).get('/api/v1/customers').set('Authorization', `Bearer ${staff}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/crops').set('Authorization', `Bearer ${staff}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/employees').set('Authorization', `Bearer ${staff}`).expect(403);
  });

  it('blocks employees management for agents but allows manager read', async () => {
    const agent = await loginToken(app, USERS.AGENT);
    await request(app.getHttpServer()).get('/api/v1/employees').set('Authorization', `Bearer ${agent}`).expect(403);
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', `Bearer ${agent}`).send({}).expect(403);
    const manager = await loginToken(app, USERS.MANAGER);
    await request(app.getHttpServer()).get('/api/v1/employees').set('Authorization', `Bearer ${manager}`).expect(200);
  });

  it('restricts deactivation to the founder', async () => {
    const founder = await loginToken(app, USERS.FOUNDER);
    const manager = await loginToken(app, USERS.MANAGER);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'AGENT' } });

    const created = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${founder}`)
      .send({ email: uniqueEmail('mgr-target'), fullName: 'Manager Target', roleId: role.id, password: 'TargetPass1' })
      .expect(201);
    const id = (created.body as { employee: { id: string } }).employee.id;

    await request(app.getHttpServer())
      .post(`/api/v1/employees/${id}/deactivate`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${id}/deactivate`)
      .set('Authorization', `Bearer ${founder}`)
      .expect(204);
  });

  it('prevents non-founders from assigning the founder role', async () => {
    const manager = await loginToken(app, USERS.MANAGER);
    const founderRole = await prisma.role.findUniqueOrThrow({ where: { code: 'FOUNDER' } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${manager}`)
      .send({ email: uniqueEmail('wannabe-founder'), fullName: 'Wannabe', roleId: founderRole.id, password: 'TargetPass1' })
      .expect(403);
    expect(res.body.error.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('scopes agent customer visibility to own/owned records', async () => {
    const agent = await loginToken(app, USERS.AGENT);
    const founder = await loginToken(app, USERS.FOUNDER);
    const manager = await loginToken(app, USERS.MANAGER);

    // Agent creates their own customer.
    const mine = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agent}`)
      .send({ fullName: 'My Own Farmer', phones: { phones: [{ number: '9811111111', isPrimary: true }] } })
      .expect(201);

    // Founder creates a customer and a lead for it, then manager assigns the
    // lead to the agent — from then on the customer is visible to the agent.
    const other = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${founder}`)
      .send({ fullName: 'Someone Elses Farmer', phones: { phones: [{ number: '9822222222', isPrimary: true }] } })
      .expect(201);
    const otherId = (other.body as { id: string }).id;
    const lead = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${founder}`)
      .send({ customerId: otherId, source: 'TEST' })
      .expect(201);
    const leadId = (lead.body as { id: string }).id;
    const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;

    // Before assignment, the agent cannot see the other customer.
    let list = await request(app.getHttpServer()).get('/api/v1/customers').set('Authorization', `Bearer ${agent}`).expect(200);
    let ids = (list.body as { items: Array<{ id: string }> }).items.map((c) => c.id);
    expect(ids).toContain((mine.body as { id: string }).id);
    expect(ids).not.toContain(otherId);

    await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ employeeId: agentId, reason: 'coverage test' })
      .expect(201);

    list = await request(app.getHttpServer()).get('/api/v1/customers').set('Authorization', `Bearer ${agent}`).expect(200);
    ids = (list.body as { items: Array<{ id: string }> }).items.map((c) => c.id);
    expect(ids).toContain(otherId);

    // Direct profile access is also scoped.
    await request(app.getHttpServer()).get(`/api/v1/customers/${otherId}`).set('Authorization', `Bearer ${agent}`).expect(200);
  });
});
