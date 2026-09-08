import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, uniqueEmail, USERS } from './helpers';
describe('leads + ownership', () => {
    let app;
    let prisma;
    let agentToken;
    let managerToken;
    let founderToken;
    let founderId;
    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        agentToken = await loginToken(app, USERS.AGENT);
        managerToken = await loginToken(app, USERS.MANAGER);
        founderToken = await loginToken(app, USERS.FOUNDER);
        founderId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } })).id;
    });
    beforeEach(async () => {
        await resetData(prisma);
    });
    afterAll(async () => {
        await app.close();
    });
    async function makeCustomerAndLead(name, phone, token = agentToken) {
        const customerId = await createCustomerAs(app, token, name, phone);
        const lead = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${token}`)
            .send({ customerId, source: 'TEST', notes: 'demo' })
            .expect(201);
        return { customerId, leadId: lead.body.id };
    }
    it('creates a lead auto-assigned to the creating agent', async () => {
        const { customerId, leadId } = await makeCustomerAndLead('Lead Farmer', '9876544001');
        const detail = await request(app.getHttpServer())
            .get(`/api/v1/leads/${leadId}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        const body = detail.body;
        expect(body.customer.id).toBe(customerId);
        expect(body.customer.primaryPhone).toBe('+919876544001');
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        expect(body.currentOwner?.id).toBe(agentId);
        expect(body.ownershipHistory).toHaveLength(1);
        expect(body.ownershipHistory[0]?.isCurrent).toBe(true);
    });
    it('shows only owned leads to an agent', async () => {
        await makeCustomerAndLead('Mine', '9876544002', agentToken);
        const res = await request(app.getHttpServer())
            .get('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        const mine = await request(app.getHttpServer())
            .get('/api/v1/leads?q=mine')
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        expect(mine.body.total).toBe(1);
        expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });
    it('reassigns a lead (manager) and closes the previous ownership window', async () => {
        const { leadId } = await makeCustomerAndLead('Reassign Farmer', '9876544003');
        const res = await request(app.getHttpServer())
            .post(`/api/v1/leads/${leadId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: founderId, reason: 'handover to founder' })
            .expect(201);
        const body = res.body;
        expect(body.currentOwner?.id).toBe(founderId);
        expect(body.ownershipHistory).toHaveLength(2);
        const [latest, previous] = body.ownershipHistory;
        expect(latest?.isCurrent).toBe(true);
        expect(previous?.isCurrent).toBe(false);
        // The original agent no longer owns the lead → invisible to them now.
        await request(app.getHttpServer()).get(`/api/v1/leads/${leadId}`).set('Authorization', `Bearer ${agentToken}`).expect(404);
        const list = await request(app.getHttpServer()).get('/api/v1/leads?q=reassign').set('Authorization', `Bearer ${agentToken}`).expect(200);
        expect(list.body.total).toBe(0);
    });
    it('cannot assign a lead to an inactive employee', async () => {
        const { leadId } = await makeCustomerAndLead('Bad Assign', '9876544004');
        const created = await request(app.getHttpServer())
            .post('/api/v1/employees')
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ email: uniqueEmail('inactive-agent'), fullName: 'Inactive Agent', roleId: (await prisma.role.findUniqueOrThrow({ where: { code: 'AGENT' } })).id, password: 'TempPass1' })
            .expect(201);
        const inactiveId = created.body.employee.id;
        await request(app.getHttpServer())
            .post(`/api/v1/employees/${inactiveId}/deactivate`)
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(204);
        const res = await request(app.getHttpServer())
            .post(`/api/v1/leads/${leadId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: inactiveId, reason: 'nope' })
            .expect(400);
        expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });
    it('rejects a lead on an inactive customer', async () => {
        const customerId = await createCustomerAs(app, managerToken, 'Inactive Customer Lead', '9876544005');
        await request(app.getHttpServer())
            .post(`/api/v1/customers/${customerId}/deactivate`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(204);
        const res = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(400);
        expect(res.body.error.code).toBe('CUSTOMER_INACTIVE');
    });
    it('updates lead notes/source', async () => {
        const { leadId } = await makeCustomerAndLead('Edit Lead', '9876544006');
        const res = await request(app.getHttpServer())
            .patch(`/api/v1/leads/${leadId}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ notes: 'updated notes', source: 'REFERRAL' })
            .expect(200);
        const body = res.body;
        expect(body.notes).toBe('updated notes');
        expect(body.source).toBe('REFERRAL');
    });
});
