import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, uniqueEmail, USERS } from './helpers';
import { hashPassword } from '../src/modules/auth/password.util';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
describe('relationship ownership — RM workspace, assignment, release (Month 4)', () => {
    let app;
    let prisma;
    let founderToken;
    let managerToken;
    let agentToken;
    let staffToken;
    let managerId;
    let secondManagerId;
    let agentId;
    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        founderToken = await loginToken(app, USERS.FOUNDER);
        managerToken = await loginToken(app, USERS.MANAGER);
        agentToken = await loginToken(app, USERS.AGENT);
        staffToken = await loginToken(app, USERS.STAFF);
        managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        // A second RM holder for transfer tests (not the seeded default RM).
        const managerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } });
        const second = await prisma.employee.create({
            data: {
                email: uniqueEmail('rm2'),
                fullName: 'Second Manager',
                roleId: managerRole.id,
                passwordHash: await hashPassword('Founder@123'),
            },
        });
        secondManagerId = second.id;
    });
    beforeEach(async () => {
        await resetData(prisma);
    });
    afterAll(async () => {
        await prisma.employee.deleteMany({ where: { email: { startsWith: 'rm2-' } } });
        await app.close();
    });
    /** Full conversion flow (agent dial → connect → end → Interested→Sales). */
    async function salesConvertedCustomer(phone) {
        const customerId = await createCustomerAs(app, agentToken, 'RM Converted Farmer', phone);
        const lead = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201);
        const leadId = lead.body.id;
        const placed = await request(app.getHttpServer())
            .post('/api/v1/calls')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ phoneNumber: phone, leadId })
            .expect(201);
        const callId = placed.body.id;
        await sleep(80);
        await request(app.getHttpServer()).post(`/api/v1/calls/${callId}/end`).set('Authorization', `Bearer ${agentToken}`).expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/calls/${callId}/outcome`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ outcome: 'INTERESTED', nextAction: 'SALES' })
            .expect(201);
        return customerId;
    }
    async function rmList(token, query = '') {
        const res = await request(app.getHttpServer()).get(`/api/v1/relationship/customers${query}`).set('Authorization', `Bearer ${token}`).expect(200);
        return res.body.items;
    }
    it('RBAC: agent and staff cannot access the RM workspace; founder and manager can', async () => {
        await request(app.getHttpServer()).get('/api/v1/relationship/customers').set('Authorization', `Bearer ${agentToken}`).expect(403);
        await request(app.getHttpServer()).get('/api/v1/relationship/customers').set('Authorization', `Bearer ${staffToken}`).expect(403);
        await request(app.getHttpServer()).get('/api/v1/relationship/holders').set('Authorization', `Bearer ${staffToken}`).expect(403);
        expect((await rmList(managerToken)).length).toBe(0);
        expect((await rmList(founderToken)).length).toBe(0);
        // Agents cannot mutate ownership either.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${managerId}/assign`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ employeeId: managerId })
            .expect(403);
    });
    it('Sales conversion hands the customer to the seeded RM; manager sees only their own portfolio', async () => {
        const customerId = await salesConvertedCustomer('9876547101');
        const managerItems = await rmList(managerToken);
        expect(managerItems).toHaveLength(1);
        expect(managerItems[0]?.customer.id).toBe(customerId);
        expect(managerItems[0]?.owner?.fullName).toBe('Manager One');
        expect(managerItems[0]?.lastCall?.outcome).toBe('INTERESTED');
        const founderItems = await rmList(founderToken);
        expect(founderItems.some((i) => i.customer.id === customerId)).toBe(true);
        // rmId filter narrows the founder view.
        const secondHolderItems = await rmList(founderToken, `?rmId=${secondManagerId}`);
        expect(secondHolderItems).toHaveLength(0);
        // Manager cannot filter to another holder's portfolio (ownership restriction).
        await request(app.getHttpServer()).get(`/api/v1/relationship/customers?rmId=${secondManagerId}`).set('Authorization', `Bearer ${managerToken}`).expect(403);
        expect(await prisma.auditEvent.count({ where: { action: 'relationship.assigned' } })).toBe(1);
    });
    it('founder reassigns to another RM holder (audited); manager cannot touch another portfolio', async () => {
        const customerId = await salesConvertedCustomer('9876547111');
        // Founder reassigns the Sales-converted customer (seeded RM) to the second manager.
        const res = await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: secondManagerId, reason: 'regional split' })
            .expect(201);
        expect(res.body.owner.id).toBe(secondManagerId);
        // The seeded manager no longer owns it — reassigning another portfolio is 403.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: secondManagerId, reason: 'sneaky' })
            .expect(403);
        const secondHolderItems = await rmList(founderToken, `?rmId=${secondManagerId}`);
        expect(secondHolderItems).toHaveLength(1);
        const managerItems = await rmList(managerToken);
        expect(managerItems).toHaveLength(0);
        // History: previous row released, audit trail carries both sides.
        const active = await prisma.relationshipOwnership.findFirstOrThrow({ where: { customerId, releasedAt: null } });
        expect(active.employeeId).toBe(secondManagerId);
        expect(active.reason).toBe('regional split');
        expect(await prisma.relationshipOwnership.count({ where: { customerId, releasedAt: { not: null } } })).toBe(1);
        expect(await prisma.auditEvent.count({ where: { action: 'relationship.assigned', entityType: 'RELATIONSHIP_OWNERSHIP' } })).toBe(2);
        // Idempotent: assigning the same holder is a no-op (still one active row).
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: secondManagerId })
            .expect(201);
        expect(await prisma.relationshipOwnership.count({ where: { customerId, releasedAt: null } })).toBe(1);
    });
    it('invalid holders are rejected; agent employees cannot hold RM ownership', async () => {
        const customerId = await salesConvertedCustomer('9876547121');
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: agentId })
            .expect(400);
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: 'not-a-uuid' })
            .expect(400);
    });
    it('release + unassigned list: manager claims an unassigned converted customer to themselves', async () => {
        const customerId = await salesConvertedCustomer('9876547131');
        // Give the second manager ownership first, so the seeded manager cannot release it.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: secondManagerId, reason: 'split' })
            .expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/release`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ reason: 'nope' })
            .expect(403);
        // Founder releases → the customer is unassigned and shows up there.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/release`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ reason: 'RM overload' })
            .expect(200);
        const unassigned = (await request(app.getHttpServer())
            .get('/api/v1/relationship/customers?unassigned=1')
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(200)).body;
        expect(unassigned.items.some((i) => i.customer.id === customerId)).toBe(true);
        expect(unassigned.items.find((i) => i.customer.id === customerId)?.owner).toBeNull();
        // Manager cannot grab an unassigned customer for a different manager…
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: secondManagerId, reason: 'claim for colleague' })
            .expect(403);
        // …but can claim it for themselves.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: managerId, reason: 'claim' })
            .expect(201);
        expect((await rmList(managerToken)).some((i) => i.customer.id === customerId)).toBe(true);
        expect(await prisma.auditEvent.count({ where: { action: 'relationship.released' } })).toBe(1);
        // Release again (founder) and a second release on the now-unassigned customer is a 409.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/release`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({})
            .expect(200);
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/release`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({})
            .expect(409);
    });
    it('customer notes: add + list with audit; scoped visibility; staff forbidden', async () => {
        const customerId = await createCustomerAs(app, managerToken, 'Note Farmer', '9876547141');
        // Agent cannot read a manager-created customer (out of scope) → 404.
        await request(app.getHttpServer()).get(`/api/v1/customers/${customerId}/notes`).set('Authorization', `Bearer ${agentToken}`).expect(404);
        const added = await request(app.getHttpServer())
            .post(`/api/v1/customers/${customerId}/notes`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ body: 'Prefers calls after 6 pm; speaks Tamil.' })
            .expect(201);
        const noteId = added.body.id;
        expect(added.body.author.fullName).toBe('Manager One');
        expect(await prisma.auditEvent.count({ where: { entityType: 'CUSTOMER_NOTE', action: 'customer.note_added' } })).toBe(1);
        const notes = (await request(app.getHttpServer()).get(`/api/v1/customers/${customerId}/notes`).set('Authorization', `Bearer ${managerToken}`).expect(200)).body;
        expect(notes.some((n) => n.id === noteId)).toBe(true);
        await request(app.getHttpServer())
            .post(`/api/v1/customers/${customerId}/notes`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ body: 'sneaky' })
            .expect(403);
        await request(app.getHttpServer())
            .post(`/api/v1/customers/${customerId}/notes`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ body: 'x' })
            .expect(400);
    });
});
