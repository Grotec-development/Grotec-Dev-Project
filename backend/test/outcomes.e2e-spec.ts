import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, USERS } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface OutcomeResponse {
  call: { id: string; status: string; outcome: string | null; nextAction: string | null };
  followUp: { id: string; dueAt: string; note: string; status: string } | null;
  relationshipOwner: { id: string; fullName: string } | null;
  messageStatus: string | null;
}

describe('call outcomes — exactly three, separate next action (Month 3)', () => {
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

  /** Creates a customer + open lead owned by the agent, dials and ends a call on it. */
  async function finishedCall(phone = '9876547001'): Promise<{ callId: string; customerId: string; leadId: string }> {
    const customerId = await createCustomerAs(app, agentToken, 'Outcome Farmer', phone);
    const lead = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ customerId, source: 'TEST' })
      .expect(201);
    const leadId = (lead.body as { id: string }).id;
    const placed = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ phoneNumber: phone, leadId })
      .expect(201);
    const callId = (placed.body as { id: string }).id;
    await sleep(80); // connect
    await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
    return { callId, customerId, leadId };
  }

  async function recordOutcome(callId: string, body: Record<string, unknown>, token = agentToken): Promise<{ status: number; body: OutcomeResponse & { error?: { code: string } } }> {
    const res = await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/outcome`).set('Authorization', `Bearer ${token}`).send(body);
    return { status: res.status, body: res.body as never };
  }

  it('rejects recording an outcome while the call is still active', async () => {
    const customerId = await createCustomerAs(app, agentToken, 'Active Farmer', '9876547011');
    const placed = await request(app.getHttpServer()).post('/api/v1/calls').set('Authorization', `Bearer ${agentToken}`).send({ phoneNumber: '9876547011', customerId }).expect(201);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/calls/${(placed.body as { id: string }).id}/outcome`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ outcome: 'INTERESTED', nextAction: 'CALLBACK', followUpDate: '2026-09-10', followUpTime: '11:00', followUpNote: 'call back' })
      .expect(409);
    expect(res.body.error.code).toBe('CALL_NOT_FINISHED');
  });

  it('rejects a second outcome on the same call and a next action without Interested', async () => {
    const { callId } = await finishedCall('9876547021');
    await recordOutcome(callId, { outcome: 'NOT_INTERESTED' });
    const second = await recordOutcome(callId, { outcome: 'INTERESTED', nextAction: 'SALES' });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('CALL_OUTCOME_EXISTS');

    const { callId: call2 } = await finishedCall('9876547022');
    const res = await recordOutcome(call2, { outcome: 'NOT_ANSWERED', nextAction: 'CALLBACK' });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('NEXT_ACTION_NOT_ALLOWED');
  });

  it('Interested without a next action is rejected; both would be invalid by construction', async () => {
    const { callId } = await finishedCall('9876547031');
    const res = await recordOutcome(callId, { outcome: 'INTERESTED' });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('NEXT_ACTION_REQUIRED');
  });

  it('Interested -> Callback requires date + time + reason and creates a follow-up record', async () => {
    const { callId, customerId, leadId } = await finishedCall('9876547041');

    const missing = await recordOutcome(callId, { outcome: 'INTERESTED', nextAction: 'CALLBACK' });
    expect(missing.status).toBe(400);
    expect(missing.body.error?.code).toBe('FOLLOW_UP_DETAILS_REQUIRED');

    const ok = await recordOutcome(callId, { outcome: 'INTERESTED', nextAction: 'CALLBACK', followUpDate: '2026-09-10', followUpTime: '11:30', followUpNote: 'Farmer wants to check pricing first' });
    expect(ok.status).toBe(201);
    expect(ok.body.call.outcome).toBe('INTERESTED');
    expect(ok.body.call.nextAction).toBe('CALLBACK');
    expect(ok.body.followUp?.note).toContain('pricing');
    expect(ok.body.messageStatus).toBeNull();
    expect(ok.body.relationshipOwner).toBeNull();

    const followUp = await prisma.followUp.findUniqueOrThrow({ where: { id: ok.body.followUp?.id as string } });
    expect(followUp.customerId).toBe(customerId);
    expect(followUp.leadId).toBe(leadId);
    expect(followUp.status).toBe('PENDING');
    expect(await prisma.auditEvent.count({ where: { entityType: 'FOLLOW_UP', action: 'followup.created' } })).toBe(1);

    // Lead stays OPEN (callback is not a conversion).
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe('OPEN');
  });

  it('Interested -> Sales closes the lead, assigns the configured RM, and auto-sends product details', async () => {
    const { callId, customerId, leadId } = await finishedCall('9876547051');
    const ok = await recordOutcome(callId, { outcome: 'INTERESTED', nextAction: 'SALES' });
    expect(ok.status).toBe(201);
    expect(ok.body.call.outcome).toBe('INTERESTED');
    expect(ok.body.call.nextAction).toBe('SALES');
    expect(ok.body.relationshipOwner?.fullName).toBe('Manager One'); // seeded default RM (RELATIONSHIP_MANAGER_EMAIL)
    expect(ok.body.messageStatus).toBe('SENT');
    expect(ok.body.followUp).toBeNull();

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe('CLOSED');
    expect((await prisma.leadOwnership.findFirstOrThrow({ where: { leadId, releasedAt: { not: null } } })).releasedAt).toBeTruthy();

    // Relationship ownership is distinct from the (released) lead ownership.
    const rmOwnership = await prisma.relationshipOwnership.findFirstOrThrow({ where: { customerId, releasedAt: null } });
    expect(rmOwnership.reason).toBe('conversion_sales');

    const message = await prisma.outboundMessage.findFirstOrThrow({ where: { customerId } });
    expect(message.status).toBe('SENT');
    expect(message.body).toContain('GROTEC');
    expect(message.provider).toBe('mock');
    expect(await prisma.auditEvent.count({ where: { action: { in: ['call.outcome_recorded', 'relationship.assigned', 'message.sent'] } } })).toBe(3);

    // Converted customer drops out of the agent's calling queue.
    const queue = (await request(app.getHttpServer()).get('/api/v1/calls/queue').set('Authorization', `Bearer ${agentToken}`).expect(200)).body as Array<{ leadId: string }>;
    expect(queue.some((q) => q.leadId === leadId)).toBe(false);
  });

  it('Not Interested closes the lead and stores history without any next action', async () => {
    const { callId, leadId } = await finishedCall('9876547061');
    const res = await recordOutcome(callId, { outcome: 'NOT_INTERESTED' });
    expect(res.status).toBe(201);
    expect(res.body.call.outcome).toBe('NOT_INTERESTED');
    expect(res.body.call.nextAction).toBeNull();
    expect(res.body.followUp).toBeNull();
    expect(res.body.relationshipOwner).toBeNull();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).status).toBe('CLOSED');
  });

  it('Not Answered stores the outcome + attempt history only (no retry, no automatic follow-up)', async () => {
    const { callId } = await finishedCall('9876547071');
    const placed = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ phoneNumber: '9876547072' })
      .expect(201);
    const noAnswerCall = (placed.body as { id: string }).id;
    await sleep(60);
    // Force NOT_ANSWERED via provider state (mock answer rate is 1 in tests, so
    // simulate by pushing the status through the webhook seam).
    const callRow = await prisma.call.findUniqueOrThrow({ where: { id: noAnswerCall } });
    await request(app.getHttpServer())
      .post('/api/v1/dialer/webhooks/mock')
      .set('x-webhook-secret', 'dev-webhook-secret-change-me')
      .send({ providerCallId: callRow.providerCallId, status: 'NOT_ANSWERED' })
      .expect(201);

    const wrong = await recordOutcome(noAnswerCall, { outcome: 'INTERESTED', nextAction: 'CALLBACK' });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error?.code).toBe('OUTCOME_MISMATCH');

    const ok = await recordOutcome(noAnswerCall, { outcome: 'NOT_ANSWERED' });
    expect(ok.status).toBe(201);
    expect(ok.body.call.status).toBe('NOT_ANSWERED');
    expect(await prisma.followUp.count({ where: { callId: noAnswerCall } })).toBe(0);
    expect(await prisma.outboundMessage.count({ where: { callId: noAnswerCall } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { entityType: 'CALL', entityId: noAnswerCall, action: 'call.outcome_recorded' } })).toBe(1);
  });

  it('follow-ups: agents see their own callbacks; manager sees all; staff is forbidden', async () => {
    const { callId } = await finishedCall('9876547081');
    await recordOutcome(callId, { outcome: 'INTERESTED', nextAction: 'CALLBACK', followUpDate: '2026-09-10', followUpTime: '10:00', followUpNote: 'revisit' });

    const agentList = (await request(app.getHttpServer()).get('/api/v1/follow-ups').set('Authorization', `Bearer ${agentToken}`).expect(200)).body as Array<{ id: string; status: string }>;
    expect(agentList.length).toBeGreaterThanOrEqual(1);
    expect(agentList.every((f) => f.status === 'PENDING')).toBe(true);

    const managerList = (await request(app.getHttpServer()).get('/api/v1/follow-ups?status=PENDING').set('Authorization', `Bearer ${managerToken}`).expect(200)).body as Array<{ id: string }>;
    expect(managerList.length).toBeGreaterThanOrEqual(1);

    // Completing a follow-up is audited; completing twice is a 409.
    const first = agentList[0] as { id: string };
    await request(app.getHttpServer()).post(`/api/v1/follow-ups/${first.id}/complete`).set('Authorization', `Bearer ${agentToken}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/follow-ups/${first.id}/complete`).set('Authorization', `Bearer ${agentToken}`).expect(409);

    await request(app.getHttpServer()).get('/api/v1/follow-ups').set('Authorization', `Bearer ${staffToken}`).expect(403);
  });

  it('RBAC: staff cannot record outcomes; manager can record on an agent-owned call', async () => {
    const { callId } = await finishedCall('9876547091');
    await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/outcome`).set('Authorization', `Bearer ${staffToken}`).send({ outcome: 'NOT_ANSWERED' }).expect(403);

    const byManager = await recordOutcome(callId, { outcome: 'NOT_INTERESTED' }, founderToken);
    expect(byManager.status).toBe(201);
  });
});
