import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, createCustomerAs, loginToken, resetData, USERS } from './helpers';

/**
 * Customer referrals (Step 3B).
 *
 * A referral records that an existing customer referred a NEW lead. The referred
 * customer is never stored on the referral — it is derived through
 * lead.customerId. Referrals are append-only: no update, no delete.
 */
describe('referrals', () => {
    let app;
    let prisma;
    let agentToken;
    let managerToken;
    let deliveryToken; // holds neither referral.read nor referral.manage

    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        agentToken = await loginToken(app, USERS.AGENT);
        managerToken = await loginToken(app, USERS.MANAGER);
        deliveryToken = await loginToken(app, USERS.DELIVERY);
    });
    beforeEach(async () => {
        await resetData(prisma);
    });
    afterAll(async () => {
        await app.close();
    });

    /** Creates a lead for `customerId`; the creator becomes its current owner. */
    async function createLeadAs(token, customerId) {
        const res = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${token}`)
            .send({ customerId })
            .expect(201);
        return res.body.id;
    }
    function postReferral(token, body, expected) {
        return request(app.getHttpServer())
            .post('/api/v1/referrals')
            .set('Authorization', `Bearer ${token}`)
            .send(body)
            .expect(expected);
    }
    function listReferrals(token, customerId, expected = 200) {
        return request(app.getHttpServer())
            .get(`/api/v1/referrals/customers/${customerId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(expected);
    }
    /** Referrer + a separate customer with an open lead, all owned by `token`. */
    async function scenario(token, seq) {
        const referrerId = await createCustomerAs(app, token, `Referrer ${seq}`, `98765440${seq}`);
        const referredId = await createCustomerAs(app, token, `Referred ${seq}`, `98765441${seq}`);
        const leadId = await createLeadAs(token, referredId);
        return { referrerId, referredId, leadId };
    }

    it('creates a referral and returns it', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '10');
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        expect(res.body.id).toBeTruthy();
        expect(res.body.referrerCustomer.id).toBe(referrerId);
        expect(res.body.leadId).toBe(leadId);
        expect(await prisma.referral.count()).toBe(1);
    });

    it('lists the referral against the referring customer', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '11');
        await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        const res = await listReferrals(managerToken, referrerId);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]?.leadId).toBe(leadId);
    });

    it('derives the referred customer from lead.customerId, not from stored data', async () => {
        const { referrerId, referredId, leadId } = await scenario(managerToken, '12');
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        expect(res.body.referredCustomer.id).toBe(referredId);
        // The column must not exist on the row — the value is projected via the lead.
        const row = await prisma.referral.findUnique({ where: { id: res.body.id } });
        expect(row).not.toHaveProperty('referredCustomerId');
        expect(row?.leadId).toBe(leadId);
    });

    it('rejects a self-referral', async () => {
        const referrerId = await createCustomerAs(app, managerToken, 'Self Referrer', '9876544013');
        const leadId = await createLeadAs(managerToken, referrerId);
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 400);
        expect(res.body.error.code).toBe('SELF_REFERRAL');
        expect(await prisma.referral.count()).toBe(0);
    });

    it('rejects a duplicate referral from the same referrer for the same lead', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '14');
        await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        const dup = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 409);
        expect(dup.body.error.code).toBe('REFERRAL_EXISTS');
        expect(await prisma.referral.count()).toBe(1);
    });

    it('allows a different referrer to refer the same lead', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '15');
        const otherReferrer = await createCustomerAs(app, managerToken, 'Other Referrer', '9876544215');
        await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        await postReferral(managerToken, { referrerCustomerId: otherReferrer, leadId }, 201);
        expect(await prisma.referral.count()).toBe(2);
    });

    it('rejects an inactive referrer', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '16');
        await request(app.getHttpServer())
            .post(`/api/v1/customers/${referrerId}/deactivate`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(204);
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 400);
        expect(res.body.error.code).toBe('REFERRER_INACTIVE');
        expect(await prisma.referral.count()).toBe(0);
    });

    it('rejects a soft-deleted referrer', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '17');
        await prisma.customer.update({ where: { id: referrerId }, data: { deletedAt: new Date() } });
        // The existing customer visibility mechanism refuses a deleted customer (403).
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 403);
        expect(res.body.error.code).toBe('CUSTOMER_ACCESS_FORBIDDEN');
        expect(await prisma.referral.count()).toBe(0);
    });

    it('stores optional notes and returns them', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '18');
        const res = await postReferral(managerToken,
            { referrerCustomerId: referrerId, leadId, notes: '  Referred at the Dharmapuri field day  ' }, 201);
        expect(res.body.notes).toBe('Referred at the Dharmapuri field day');
        const row = await prisma.referral.findUnique({ where: { id: res.body.id } });
        expect(row?.notes).toBe('Referred at the Dharmapuri field day');
    });

    it('stores null when no notes are supplied', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '19');
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        expect(res.body.notes).toBeNull();
    });

    it('writes an audit event for the referral', async () => {
        const { referrerId, referredId, leadId } = await scenario(managerToken, '20');
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        const audit = await prisma.auditEvent.findFirst({
            where: { entityType: 'REFERRAL', entityId: res.body.id, action: 'referral.created' },
        });
        expect(audit).toBeTruthy();
        expect(audit?.after).toMatchObject({
            referrerCustomerId: referrerId,
            leadId,
            referredCustomerId: referredId,
        });
    });

    it('blocks a role without referral.manage from creating (DELIVERY)', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '21');
        await postReferral(deliveryToken, { referrerCustomerId: referrerId, leadId }, 403);
        expect(await prisma.referral.count()).toBe(0);
    });

    it('blocks a role without referral.read from listing (DELIVERY)', async () => {
        const { referrerId } = await scenario(managerToken, '22');
        await listReferrals(deliveryToken, referrerId, 403);
    });

    it('stops an agent referring a lead owned by someone else', async () => {
        // Lead belongs to the manager; the agent owns the referrer only.
        const referredId = await createCustomerAs(app, managerToken, 'Foreign Lead Cust', '9876544023');
        const leadId = await createLeadAs(managerToken, referredId);
        const referrerId = await createCustomerAs(app, agentToken, 'Agent Referrer', '9876544123');
        const res = await postReferral(agentToken, { referrerCustomerId: referrerId, leadId }, 404);
        expect(res.body.error.code).toBe('LEAD_NOT_FOUND');
        expect(await prisma.referral.count()).toBe(0);
    });

    it('stops an agent using a referrer customer outside their scope', async () => {
        const referrerId = await createCustomerAs(app, managerToken, 'Foreign Referrer', '9876544024');
        const referredId = await createCustomerAs(app, agentToken, 'Agent Lead Cust', '9876544124');
        const leadId = await createLeadAs(agentToken, referredId);
        await postReferral(agentToken, { referrerCustomerId: referrerId, leadId }, 403);
        expect(await prisma.referral.count()).toBe(0);
    });

    it('lets an agent refer when both the customer and the lead are in scope', async () => {
        const { referrerId, leadId } = await scenario(agentToken, '25');
        const res = await postReferral(agentToken, { referrerCustomerId: referrerId, leadId }, 201);
        expect(res.body.referrerCustomer.id).toBe(referrerId);
    });

    it('enforces the duplicate rule at the database level', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '26');
        const first = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        const actor = await prisma.referral.findUnique({ where: { id: first.body.id } });
        // Bypassing the service entirely: the unique index must still refuse.
        await expect(prisma.referral.create({
            data: { referrerCustomerId: referrerId, leadId, createdById: actor.createdById },
        })).rejects.toMatchObject({ code: 'P2002' });
        expect(await prisma.referral.count()).toBe(1);
    });

    it('cannot create two rows when duplicate requests race', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '27');
        const body = { referrerCustomerId: referrerId, leadId };
        const send = () => request(app.getHttpServer())
            .post('/api/v1/referrals')
            .set('Authorization', `Bearer ${managerToken}`)
            .send(body);
        const results = await Promise.all([send(), send()]);
        const statuses = results.map((r) => r.status).sort();
        expect(statuses).toEqual([201, 409]);
        expect(await prisma.referral.count()).toBe(1);
    });

    it('exposes no update or delete endpoint (append-only history)', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '28');
        const res = await postReferral(managerToken, { referrerCustomerId: referrerId, leadId }, 201);
        await request(app.getHttpServer())
            .patch(`/api/v1/referrals/${res.body.id}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ notes: 'rewritten' })
            .expect(404);
        await request(app.getHttpServer())
            .delete(`/api/v1/referrals/${res.body.id}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(404);
        expect(await prisma.referral.count()).toBe(1);
    });

    it('rejects notes longer than 500 characters', async () => {
        const { referrerId, leadId } = await scenario(managerToken, '29');
        const res = await postReferral(managerToken,
            { referrerCustomerId: referrerId, leadId, notes: 'x'.repeat(501) }, 400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(await prisma.referral.count()).toBe(0);
    });
});
