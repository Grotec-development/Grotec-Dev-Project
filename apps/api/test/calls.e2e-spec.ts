import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, uniqueEmail, USERS } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CallBody {
  id: string;
  customerId: string | null;
  leadId: string | null;
  phoneNumber: string;
  status: string;
  provider: string;
  providerCallId: string;
  connectedAt: string | null;
  endedAt: string | null;
  disconnectReason: string | null;
  notes: Array<{ id: string; body: string; author: { id: string; fullName: string } }>;
}

describe('calls — agent calling workspace (Month 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentToken: string;
  let managerToken: string;
  let founderToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    agentToken = await loginToken(app, USERS.AGENT);
    managerToken = await loginToken(app, USERS.MANAGER);
    founderToken = await loginToken(app, USERS.FOUNDER);
    staffToken = await loginToken(app, USERS.STAFF);
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function placeCall(phone: string, token = agentToken, extra: Record<string, unknown> = {}): Promise<CallBody> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: phone, ...extra })
      .expect(201);
    return res.body as CallBody;
  }

  async function getCall(id: string, token = agentToken): Promise<CallBody> {
    const res = await request(app.getHttpServer()).get(`/api/v1/calls/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
    return res.body as CallBody;
  }

  it('dials an existing customer: resolves the number, then connects via the provider', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'Call Customer', '9876546001');
    const call = await placeCall('98765 46001'); // messy input → normalized
    expect(call.customerId).toBe(customerId);
    expect(call.phoneNumber).toBe('+919876546001');
    expect(call.status).toBe('DIALING');
    expect(call.provider).toBe('mock');
    expect(call.providerCallId).toMatch(/^mock_/);

    await sleep(80); // DIALING → RINGING → CONNECTED (test timings: 10ms + 20ms)
    const detail = await getCall(call.id);
    expect(detail.status).toBe('CONNECTED');
    expect(detail.connectedAt).toBeTruthy();
  });

  it('rejects a second active call for the same agent', async () => {
    const call = await placeCall('9876546002');
    const res = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ phoneNumber: '9876546003' })
      .expect(409);
    expect(res.body.error.code).toBe('ACTIVE_CALL_EXISTS');
    expect((res.body.error.details as { callId: string }).callId).toBe(call.id);
  });

  it('ends an active call (agent hang-up)', async () => {
    const call = await placeCall('9876546004');
    await sleep(40);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/calls/${call.id}/end`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(201);
    const ended = res.body as CallBody;
    expect(ended.status).toBe('ENDED');
    expect(ended.disconnectReason).toBe('AGENT_ENDED');
    expect(ended.endedAt).toBeTruthy();
  });

  it('mid-call customer creation: call stays active and links to the new customer immediately', async () => {
    const phone = '9876546005';
    const call = await placeCall(phone);
    expect(call.customerId).toBeNull();

    // Creating the customer must NOT interrupt the call (PRD §6.3.5).
    const customerId = await createCustomerAs(app, agentToken, 'Mid Call Farmer', phone);
    const active = ['DIALING', 'RINGING', 'CONNECTED'];
    expect(active).toContain((await getCall(call.id)).status);

    // The call links to the new customer right away so context appears mid-call.
    expect((await getCall(call.id)).customerId).toBe(customerId);
    const link = await prisma.auditEvent.findFirst({ where: { entityType: 'CALL', entityId: call.id, action: 'call.linked' } });
    expect(link?.after).toMatchObject({ customerId });

    // And it stays linked after finishing.
    await request(app.getHttpServer()).post(`/api/v1/calls/${call.id}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
    expect((await getCall(call.id)).customerId).toBe(customerId);
  });

  it('queue: shows the agent their open owned leads with customer context and last call', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'Queue Farmer', '9876546006');
    const lead = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ customerId, source: 'TEST', notes: 'dial me' })
      .expect(201);
    const leadId = (lead.body as { id: string }).id;

    const queue = (await request(app.getHttpServer()).get('/api/v1/calls/queue').set('Authorization', `Bearer ${agentToken}`).expect(200)).body as Array<{
      leadId: string;
      source: string;
      notes: string | null;
      customer: { fullName: string; primaryPhone: string };
      lastCall: { status: string } | null;
    }>;
    const item = queue.find((q) => q.leadId === leadId);
    expect(item).toBeTruthy();
    expect(item?.customer.fullName).toBe('Queue Farmer');
    expect(item?.customer.primaryPhone).toBe('+919876546006');
    expect(item?.source).toBe('TEST');
    expect(item?.lastCall).toBeNull();

    // After a completed call on the lead, the queue surfaces its last call.
    const call = await placeCall('9876546006', agentToken, { leadId });
    await sleep(40);
    await request(app.getHttpServer()).post(`/api/v1/calls/${call.id}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
    const queue2 = (await request(app.getHttpServer()).get('/api/v1/calls/queue').set('Authorization', `Bearer ${agentToken}`).expect(200)).body as Array<{
      leadId: string;
      lastCall: { status: string } | null;
    }>;
    expect(queue2.find((q) => q.leadId === leadId)?.lastCall?.status).toBe('ENDED');
  });

  it('queue: agents only see their own leads; managers can filter by ownerId', async () => {
    const customerA = await createCustomerAs(app, agentToken, 'Owner A', '9876546007');
    await request(app.getHttpServer()).post('/api/v1/leads').set('Authorization', `Bearer ${agentToken}`).send({ customerId: customerA, source: 'TEST' }).expect(201);

    const customerB = await createCustomerAs(app, founderToken, 'Owner B', '9876546008');
    const leadB = await request(app.getHttpServer()).post('/api/v1/leads').set('Authorization', `Bearer ${founderToken}`).send({ customerId: customerB, source: 'TEST' }).expect(201);
    const leadBId = (leadB.body as { id: string }).id;

    const agentQueue = (await request(app.getHttpServer()).get('/api/v1/calls/queue').set('Authorization', `Bearer ${agentToken}`).expect(200)).body as Array<{ leadId: string }>;
    expect(agentQueue.some((q) => q.leadId === leadBId)).toBe(false);

    const founderQueue = (await request(app.getHttpServer()).get('/api/v1/calls/queue').set('Authorization', `Bearer ${founderToken}`).expect(200)).body as Array<{ leadId: string }>;
    expect(founderQueue.some((q) => q.leadId === leadBId)).toBe(true);
  });

  it('notes: agent adds a note visible on the call record', async () => {
    const call = await placeCall('9876546009');
    const note = await request(app.getHttpServer())
      .post(`/api/v1/calls/${call.id}/notes`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Farmer asked about rice seed availability' })
      .expect(201);
    expect((note.body as { body: string }).body).toBe('Farmer asked about rice seed availability');

    const detail = await getCall(call.id);
    expect(detail.notes).toHaveLength(1);
    expect(detail.notes[0]?.author.fullName).toBe('Agent One');
  });

  it('call history is exposed under the customer', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'History Farmer', '9876546010');
    const call = await placeCall('9876546010');
    await sleep(30);
    await request(app.getHttpServer()).post(`/api/v1/calls/${call.id}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);

    const history = (await request(app.getHttpServer()).get(`/api/v1/customers/${customerId}/calls`).set('Authorization', `Bearer ${agentToken}`).expect(200)).body as CallBody[];
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.phoneNumber).toBe('+919876546010');
  });

  it('context endpoint returns the call, customer profile, and history', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'Context Farmer', '9876546011');
    const call = await placeCall('9876546011');

    const ctx = (await request(app.getHttpServer()).get(`/api/v1/calls/${call.id}/context`).set('Authorization', `Bearer ${agentToken}`).expect(200)).body as {
      call: CallBody;
      customer: { id: string; fullName: string } | null;
      history: CallBody[];
    };
    expect(ctx.customer?.id).toBe(customerId);
    expect(ctx.customer?.fullName).toBe('Context Farmer');
    expect(ctx.call.id).toBe(call.id);
  });

  it('webhooks: rejects a bad secret, applies a valid status push', async () => {
    const call = await placeCall('9876546012');

    await request(app.getHttpServer())
      .post('/api/v1/dialer/webhooks/mock')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ providerCallId: call.providerCallId, status: 'CONNECTED' })
      .expect(401);

    const ok = await request(app.getHttpServer())
      .post('/api/v1/dialer/webhooks/mock')
      .set('x-webhook-secret', 'dev-webhook-secret-change-me')
      .send({ providerCallId: call.providerCallId, status: 'CONNECTED' })
      .expect(201);
    expect((ok.body as { applied: boolean }).applied).toBe(true);

    expect((await getCall(call.id)).status).toBe('CONNECTED');
  });

  it('RBAC: staff cannot place calls; a second agent cannot read another agent’s call', async () => {
    await request(app.getHttpServer()).post('/api/v1/calls').set('Authorization', `Bearer ${staffToken}`).send({ phoneNumber: '9876546013' }).expect(403);

    const call = await placeCall('9876546014');
    await request(app.getHttpServer()).get(`/api/v1/calls/${call.id}`).set('Authorization', `Bearer ${managerToken}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/calls/${call.id}`).set('Authorization', `Bearer ${staffToken}`).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/calls/${call.id}/notes`).set('Authorization', `Bearer ${staffToken}`).send({ body: 'nope' }).expect(403);

    // A separate agent (created by the manager) must not see the first agent's call.
    const agentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'AGENT' } });
    const email = uniqueEmail('agent2');
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email, fullName: 'Agent Two', roleId: agentRole.id, password: 'TempPass1' })
      .expect(201);
    const agent2Token = await loginToken(app, { email, password: 'TempPass1', roleCode: 'AGENT' });
    await request(app.getHttpServer()).get(`/api/v1/calls/${call.id}`).set('Authorization', `Bearer ${agent2Token}`).expect(404);
  });
});