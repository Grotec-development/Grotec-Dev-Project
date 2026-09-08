import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, USERS } from './helpers';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
describe('dashboard summary — real CRM data, role-scoped (Month 5)', () => {
    let app;
    let prisma;
    let agentToken;
    let managerToken;
    let staffToken;
    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        agentToken = await loginToken(app, USERS.AGENT);
        managerToken = await loginToken(app, USERS.MANAGER);
        staffToken = await loginToken(app, USERS.STAFF);
    });
    beforeEach(async () => {
        await resetData(prisma);
    });
    afterAll(async () => {
        await app.close();
    });
    async function summary(token) {
        const res = await request(app.getHttpServer()).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${token}`).expect(200);
        return res.body;
    }
    it('staff is forbidden; empty state returns zeros with the right shapes', async () => {
        await request(app.getHttpServer()).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${staffToken}`).expect(403);
        await request(app.getHttpServer()).get('/api/v1/dashboard/pipeline').set('Authorization', `Bearer ${staffToken}`).expect(403);
        const agent = await summary(agentToken);
        expect(agent.scope).toBe('me');
        expect(agent.window).toBe('day');
        expect(agent.calls).toEqual({ dialedToday: 0, connectedToday: 0, completedToday: 0, notAnsweredToday: 0 });
        expect(agent.recentActivity).toEqual([]);
        expect(agent.pipelineTotal).toBe(0);
        expect(agent.pipeline.every((p) => p.count === 0)).toBe(true);
        const team = await summary(managerToken);
        expect(team.scope).toBe('team');
        // range=month widens the window (still zero on an empty DB) and echoes it.
        const res = await request(app.getHttpServer()).get('/api/v1/dashboard/summary?range=month').set('Authorization', `Bearer ${managerToken}`).expect(200);
        expect(res.body.window).toBe('month');
        expect(res.body.calls.dialedToday).toBe(0);
    });
    it('agent summary reflects only the agent workload (calls, follow-ups, queue)', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Dash Farmer', '9876547201');
        const lead = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201);
        const leadId = lead.body.id;
        // One dialed + connected + ended call, one not-answered via the webhook seam.
        const placed = await request(app.getHttpServer())
            .post('/api/v1/calls')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ phoneNumber: '9876547202', customerId, leadId })
            .expect(201);
        const callId = placed.body.id;
        await sleep(80);
        await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
        const missed = await request(app.getHttpServer())
            .post('/api/v1/calls')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ phoneNumber: '9876547203' })
            .expect(201);
        const missedId = missed.body.id;
        await sleep(60);
        const row = await prisma.call.findUniqueOrThrow({ where: { id: missedId } });
        await request(app.getHttpServer())
            .post('/api/v1/dialer/webhooks/mock')
            .set('x-webhook-secret', 'dev-webhook-secret-change-me')
            .send({ providerCallId: row.providerCallId, status: 'NOT_ANSWERED' })
            .expect(201);
        // Callback follow-up on the ended call.
        await request(app.getHttpServer())
            .post(`/api/v1/calls/${callId}/outcome`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ outcome: 'INTERESTED', nextAction: 'CALLBACK', followUpDate: '2026-09-10', followUpTime: '10:00', followUpNote: 'dash callback' })
            .expect(201);
        const agent = await summary(agentToken);
        expect(agent.calls.dialedToday).toBe(2);
        expect(agent.calls.connectedToday).toBe(1);
        expect(agent.calls.notAnsweredToday).toBe(1);
        expect(agent.leads.open).toBe(1);
        expect(agent.followUps.pending).toBe(1);
        expect(agent.recentActivity.length).toBe(2);
        expect(agent.recentActivity.every((a) => a.customerName !== undefined)).toBe(true);
        // The team view at least matches (same visible data in this empty suite).
        const team = await summary(managerToken);
        expect(team.scope).toBe('team');
        expect(team.calls.dialedToday).toBeGreaterThanOrEqual(agent.calls.dialedToday);
        expect(team.followUps.pending).toBeGreaterThanOrEqual(agent.followUps.pending);
    });
    it('Sales conversion moves numbers: closed lead, converted + interested customers', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Dash Sales Farmer', '9876547211');
        const lead = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201);
        const leadId = lead.body.id;
        const placed = await request(app.getHttpServer())
            .post('/api/v1/calls')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ phoneNumber: '9876547211', customerId, leadId })
            .expect(201);
        const callId = placed.body.id;
        await sleep(80);
        await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/calls/${callId}/outcome`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ outcome: 'INTERESTED', nextAction: 'SALES' })
            .expect(201);
        const agent = await summary(agentToken);
        expect(agent.leads.open).toBe(0);
        expect(agent.leads.closedTotal).toBe(1);
        expect(agent.customers.converted).toBe(1);
        expect(agent.customers.interested).toBe(1);
        const team = await summary(managerToken);
        expect(team.leads.closedTotal).toBe(1);
        expect(team.customers.converted).toBe(1); // one active RM ownership
        expect(team.customers.interested).toBe(1);
        // Drill-down: the converted slice lists this farmer for both scopes.
        const teamSlice = await request(app.getHttpServer())
            .get('/api/v1/dashboard/pipeline?state=converted')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);
        expect(teamSlice.body.total).toBe(1);
        expect(teamSlice.body.items[0].fullName).toBe('Dash Sales Farmer');
        const agentSlice = await request(app.getHttpServer())
            .get('/api/v1/dashboard/pipeline?state=converted')
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        expect(agentSlice.body.total).toBe(1);
        // An invalid state falls back to an empty never_reached slice rather than 400.
        await request(app.getHttpServer()).get('/api/v1/dashboard/pipeline?state=bogus').set('Authorization', `Bearer ${managerToken}`).expect(200);
    });
});
