import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createCustomerAs, createTestApp, loginToken, resetData, uniqueEmail, USERS } from './helpers';
import { hashPassword } from '../src/modules/auth/password.util';
/**
 * Checkpoint D: Domain integrity — farmer/customer, lead ownership, relationship
 * ownership, and concurrency.
 *
 * Covers:
 *  1. Phone uniqueness: duplicate active phone blocked (DB partial unique index).
 *  2. Phone soft-delete: deleted phone does not block the same number on a new customer.
 *  3. Customer inactive status blocks lead creation.
 *  4. Lead ownership: exactly one active owner enforced by DB partial unique index.
 *  5. Relationship ownership: exactly one active RM per customer enforced by DB partial
 *     unique index (created in Checkpoint B).
 *  6. Concurrent lead reassignment: two parallel assigns — only one succeeds.
 *  7. Concurrent relationship reassignment: two parallel assigns — only one succeeds.
 *  8. Transaction rollback: failed assignment leaves no partial ownership state.
 *  9. Reassignment invariants: releasing then re-assigning is atomic.
 *
 * All tests assert real DB state and HTTP responses — no mocks.
 */
describe('domain integrity — Checkpoint D', () => {
    let app;
    let prisma;
    let agentToken;
    let managerToken;
    let founderToken;
    let secondManagerId;
    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        agentToken = await loginToken(app, USERS.AGENT);
        managerToken = await loginToken(app, USERS.MANAGER);
        founderToken = await loginToken(app, USERS.FOUNDER);
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
    // -------------------------------------------------------------------------
    // 1. Phone uniqueness: duplicate active phone blocked by DB constraint
    // -------------------------------------------------------------------------
    it('creating two customers with the same phone: the second gets 409 CUSTOMER_PHONE_EXISTS', async () => {
        const phone = '9876500001';
        await createCustomerAs(app, agentToken, 'First Farmer', phone);
        const res = await request(app.getHttpServer())
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ fullName: 'Second Farmer', phones: { phones: [{ number: phone }] } })
            .expect(409);
        expect(res.body.error.code).toBe('CUSTOMER_PHONE_EXISTS');
    });
    // -------------------------------------------------------------------------
    // 2. Phone soft-delete: deleted phone does not block re-use on another customer
    // -------------------------------------------------------------------------
    it('soft-deleting a phone does not block the same number on a different customer', async () => {
        const phone = '9876500002';
        const id = await createCustomerAs(app, agentToken, 'Soft Delete Test', phone);
        const detail = (await request(app.getHttpServer())
            .get(`/api/v1/customers/${id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200)).body;
        const phoneId = detail.phones[0]?.id;
        expect(phoneId).toBeTruthy();
        // Remove the phone
        await request(app.getHttpServer())
            .delete(`/api/v1/customers/${id}/phones/${phoneId}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(204);
        // A different customer can now use the same number.
        const newId = await createCustomerAs(app, agentToken, 'New Farmer', phone);
        expect(newId).toBeTruthy();
        expect(newId).not.toBe(id);
        // The phone is present on the new customer, absent from the old one.
        const oldDetail = (await request(app.getHttpServer())
            .get(`/api/v1/customers/${id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200)).body;
        expect(oldDetail.phones).toHaveLength(0);
        const newDetail = (await request(app.getHttpServer())
            .get(`/api/v1/customers/${newId}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200)).body;
        expect(newDetail.phones[0]?.phone).toBe(`+91${phone}`);
    });
    // -------------------------------------------------------------------------
    // 3. Inactive customer blocks lead creation
    // -------------------------------------------------------------------------
    it('cannot open a lead on an inactive customer', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Inactive Farmer', '9876500003');
        await request(app.getHttpServer())
            .post(`/api/v1/customers/${customerId}/deactivate`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(204);
        const res = await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(400);
        expect(res.body.error.code).toBe('CUSTOMER_INACTIVE');
    });
    // -------------------------------------------------------------------------
    // 4. Lead ownership: exactly one active owner enforced by DB partial unique index
    // -------------------------------------------------------------------------
    it('DB constraint: inserting a second active lead ownership for the same lead fails with P2002', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Lead Owner Test', '9876500004');
        const lead = (await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201)).body;
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        const founderId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } })).id;
        // Direct DB insert of a second active ownership row should fail due to the
        // partial unique index lead_ownership_current_lead_idx.
        let err = null;
        try {
            await prisma.leadOwnership.create({
                data: { leadId: lead.id, employeeId: founderId, assignedById: agentId },
            });
        }
        catch (e) {
            err = e;
        }
        expect(err).not.toBeNull();
        expect(err.message.includes('lead_ownership_current_lead_idx') ||
            err.message.includes('duplicate key') ||
            err.message.includes('unique constraint')).toBe(true);
        // The correct way: reassign (release current, then create new).
        await request(app.getHttpServer())
            .post(`/api/v1/leads/${lead.id}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: founderId, reason: 'correct transfer' })
            .expect(201);
        const active = await prisma.leadOwnership.findMany({
            where: { leadId: lead.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
        expect(active[0].employeeId).toBe(founderId);
    });
    // -------------------------------------------------------------------------
    // 5. Relationship ownership: exactly one active RM per customer (Checkpt B index)
    // -------------------------------------------------------------------------
    it('DB constraint: exactly one active relationship manager per customer — second active insert fails', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'RM Constraint Test', '9876500005');
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        // Assign via the API first.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: managerId })
            .expect(201);
        // Direct DB insert of a second active row fails due to
        // relationship_ownership_current_customer_idx (Checkpoint B).
        let err = null;
        try {
            await prisma.relationshipOwnership.create({
                data: { customerId, employeeId: agentId, assignedById: agentId },
            });
        }
        catch (e) {
            err = e;
        }
        expect(err).not.toBeNull();
        expect(err.message.includes('relationship_ownership_current_customer_idx') ||
            err.message.includes('duplicate key') ||
            err.message.includes('unique constraint')).toBe(true);
    });
    // -------------------------------------------------------------------------
    // 6. Concurrent lead reassignment: exactly one succeeds
    // -------------------------------------------------------------------------
    it('concurrent lead reassignment: two parallel assigns — only one succeeds', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Concurrent Lead', '9876500006');
        const lead = (await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201)).body;
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        const founderId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } })).id;
        // Concurrent: Agent A → Manager; Agent A → Founder (two different targets).
        const [resultA, resultB] = await Promise.allSettled([
            request(app.getHttpServer())
                .post(`/api/v1/leads/${lead.id}/assign`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ employeeId: managerId }),
            request(app.getHttpServer())
                .post(`/api/v1/leads/${lead.id}/assign`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ employeeId: founderId }),
        ]);
        const statuses = [resultA, resultB].map((r) => r.status === 'fulfilled' ? r.value.status : 0);
        const successes = statuses.filter((s) => s === 201);
        const conflicts = statuses.filter((s) => s === 409);
        // Exactly one 201 (one assign wins), one 409 (the other is rejected by LEAD_OWNERSHIP_CONFLICT).
        expect(successes).toHaveLength(1);
        expect(conflicts).toHaveLength(1);
        // Exactly one active ownership row.
        const active = await prisma.leadOwnership.findMany({
            where: { leadId: lead.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 7. Concurrent relationship reassignment: exactly one succeeds
    // -------------------------------------------------------------------------
    it('concurrent relationship reassignment: two parallel assigns — only one succeeds', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Concurrent RM', '9876500007');
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        // First assign to manager.
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: managerId })
            .expect(201);
        // Concurrent: Founder → secondManager; Founder → Agent.
        const [resultA, resultB] = await Promise.allSettled([
            request(app.getHttpServer())
                .post(`/api/v1/relationship/customers/${customerId}/assign`)
                .set('Authorization', `Bearer ${founderToken}`)
                .send({ employeeId: secondManagerId }),
            request(app.getHttpServer())
                .post(`/api/v1/relationship/customers/${customerId}/assign`)
                .set('Authorization', `Bearer ${founderToken}`)
                .send({ employeeId: managerId }),
        ]);
        const statuses = [resultA, resultB].map((r) => r.status === 'fulfilled' ? r.value.status : 0);
        const successes = statuses.filter((s) => s === 201);
        const conflicts = statuses.filter((s) => s === 409);
        expect(successes).toHaveLength(1);
        expect(conflicts).toHaveLength(1);
        // Exactly one active ownership row.
        const active = await prisma.relationshipOwnership.findMany({
            where: { customerId, releasedAt: null },
        });
        expect(active).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 8. Transaction rollback: failed operation leaves no partial ownership state
    // -------------------------------------------------------------------------
    it('failed lead assign (concurrent race) leaves no partial ownership row', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Rollback Test', '9876500008');
        const lead = (await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201)).body;
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        const founderId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } })).id;
        const beforeCount = await prisma.leadOwnership.count({ where: { leadId: lead.id } });
        // Run two concurrent assigns.
        await Promise.allSettled([
            request(app.getHttpServer())
                .post(`/api/v1/leads/${lead.id}/assign`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ employeeId: managerId }),
            request(app.getHttpServer())
                .post(`/api/v1/leads/${lead.id}/assign`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ employeeId: founderId }),
        ]);
        // Exactly one total ownership row for this lead (no duplicates, no orphans).
        const totalCount = await prisma.leadOwnership.count({ where: { leadId: lead.id } });
        expect(totalCount).toBe(beforeCount + 1); // one new row created, old one released
        const active = await prisma.leadOwnership.findMany({
            where: { leadId: lead.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 9. Reassignment: release + re-assign produces exactly one active owner
    // -------------------------------------------------------------------------
    it('releasing then reassigning a lead produces exactly one active owner', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Reassign Lead', '9876500009');
        const lead = (await request(app.getHttpServer())
            .post('/api/v1/leads')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ customerId, source: 'TEST' })
            .expect(201)).body;
        const agentId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } })).id;
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        // Manager takes over from agent.
        await request(app.getHttpServer())
            .post(`/api/v1/leads/${lead.id}/assign`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ employeeId: managerId })
            .expect(201);
        // Agent no longer sees it.
        await request(app.getHttpServer())
            .get(`/api/v1/leads/${lead.id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(404);
        // Exactly one active owner.
        const active = await prisma.leadOwnership.findMany({
            where: { leadId: lead.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
        expect(active[0].employeeId).toBe(managerId);
        // History: two rows total.
        const history = await prisma.leadOwnership.findMany({ where: { leadId: lead.id } });
        expect(history).toHaveLength(2);
        expect(history.filter((r) => r.releasedAt === null)).toHaveLength(1);
        expect(history.filter((r) => r.releasedAt !== null)).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 10. Relationship reassignment: idempotent re-assign produces one active owner
    // -------------------------------------------------------------------------
    it('idempotent relationship reassign: assigning the same holder is a no-op', async () => {
        const customerId = await createCustomerAs(app, agentToken, 'Idempotent RM', '9876500010');
        const managerId = (await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } })).id;
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: managerId })
            .expect(201);
        // Re-assign to the same manager: still 201 (no-op).
        await request(app.getHttpServer())
            .post(`/api/v1/relationship/customers/${customerId}/assign`)
            .set('Authorization', `Bearer ${founderToken}`)
            .send({ employeeId: managerId })
            .expect(201);
        // Exactly one active row — no duplicate.
        const active = await prisma.relationshipOwnership.findMany({
            where: { customerId, releasedAt: null },
        });
        expect(active).toHaveLength(1);
        expect(active[0].employeeId).toBe(managerId);
        // Audit count: one ASSIGNED event (not two).
        const auditCount = await prisma.auditEvent.count({
            where: { action: 'relationship.assigned', entityType: 'RELATIONSHIP_OWNERSHIP' },
        });
        expect(auditCount).toBe(1);
    });
    // -------------------------------------------------------------------------
    // 11. Phone normalization: various input formats all normalize to E.164
    // -------------------------------------------------------------------------
    it('phone input formats are normalized to E.164', async () => {
        const formats = ['9876500011', '+91 98765 00011', '+919876500011', '09876500011'];
        for (const format of formats) {
            const res = await request(app.getHttpServer())
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({ fullName: `Phone Format ${format}`, phones: { phones: [{ number: format }] } })
                .expect(201);
            const body = res.body;
            expect(body.phones[0]?.phone).toBe('+919876500011');
        }
    });
});
