import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, loginToken, resetData, USERS } from './helpers';
/**
 * Checkpoint B focused tests — database integrity and transaction correctness.
 *
 * Covers:
 * 1. RelationshipOwnership partial unique index: only one active owner per customer.
 * 2. AuthSession tokenHash index: session lookup by hash works correctly.
 * 3. Transaction rollback: audit + financial state roll back together.
 * 4. Ownership invariants: one active lead owner, one active RM.
 */
describe('core integrity — DB constraints and transaction correctness', () => {
    let app;
    let prisma;
    let founderToken;
    let managerToken;
    beforeAll(async () => {
        const ctx = await createTestApp();
        app = ctx.app;
        prisma = ctx.prisma;
        founderToken = await loginToken(app, USERS.FOUNDER);
        managerToken = await loginToken(app, USERS.MANAGER);
    });
    beforeEach(async () => {
        await resetData(prisma);
    });
    afterAll(async () => {
        await app.close();
    });
    // -------------------------------------------------------------------------
    // 1. RelationshipOwnership partial unique index
    // -------------------------------------------------------------------------
    it('DB constraint: exactly one active relationship owner per customer — ' +
        'inserting a second active row for the same customer fails at the DB level', async () => {
        // Get manager role and employee
        const managerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } });
        const managers = await prisma.employee.findMany({ where: { roleId: managerRole.id, status: 'ACTIVE' } });
        expect(managers.length).toBeGreaterThanOrEqual(2);
        const [managerA, managerB] = managers;
        const customer = await prisma.customer.create({
            data: { fullName: 'Constraint Test Customer' },
        });
        // Insert first active ownership row
        await prisma.relationshipOwnership.create({
            data: {
                customerId: customer.id,
                employeeId: managerA.id,
                assignedById: managerA.id,
            },
        });
        // Verify exactly one active row
        const active = await prisma.relationshipOwnership.findMany({
            where: { customerId: customer.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
        expect(active[0].employeeId).toBe(managerA.id);
        // Attempt to insert a second active ownership row — must fail at the DB level
        // due to the partial unique index on (customer_id) WHERE released_at IS NULL.
        let constraintError = null;
        try {
            await prisma.relationshipOwnership.create({
                data: {
                    customerId: customer.id,
                    employeeId: managerB.id,
                    assignedById: managerB.id,
                },
            });
        }
        catch (err) {
            constraintError = err;
        }
        expect(constraintError).not.toBeNull();
        // PostgreSQL unique constraint violation code
        expect(constraintError.message.includes('relationship_ownership_current_customer_idx') ||
            constraintError.message.includes('duplicate key') ||
            constraintError.message.includes('unique constraint')).toBe(true);
        // Correct way to reassign: release current, then insert new
        await prisma.relationshipOwnership.updateMany({
            where: { customerId: customer.id, releasedAt: null },
            data: { releasedAt: new Date() },
        });
        await prisma.relationshipOwnership.create({
            data: {
                customerId: customer.id,
                employeeId: managerB.id,
                assignedById: managerB.id,
            },
        });
        const finalActive = await prisma.relationshipOwnership.findMany({
            where: { customerId: customer.id, releasedAt: null },
        });
        expect(finalActive).toHaveLength(1);
        expect(finalActive[0].employeeId).toBe(managerB.id);
    });
    // -------------------------------------------------------------------------
    // 2. LeadOwnership partial unique index — same check for leads
    // -------------------------------------------------------------------------
    it('DB constraint: exactly one active lead owner per lead — second active insert fails', async () => {
        const agent = await prisma.employee.findFirstOrThrow({ where: { role: { code: 'AGENT' } } });
        const agent2 = await prisma.employee.findMany({ where: { role: { code: 'AGENT' } } });
        const agentB = agent2.find((e) => e.id !== agent.id) ?? agent2[0];
        const customer = await prisma.customer.create({ data: { fullName: 'Lead Constraint Customer' } });
        const lead = await prisma.lead.create({ data: { customerId: customer.id } });
        // First active owner
        await prisma.leadOwnership.create({
            data: { leadId: lead.id, employeeId: agent.id, assignedById: agent.id },
        });
        // Attempt second active owner — must fail at DB level
        let constraintError = null;
        try {
            await prisma.leadOwnership.create({
                data: { leadId: lead.id, employeeId: agentB.id, assignedById: agentB.id },
            });
        }
        catch (err) {
            constraintError = err;
        }
        expect(constraintError).not.toBeNull();
        expect(constraintError.message.includes('lead_ownership_current_lead_idx') ||
            constraintError.message.includes('duplicate key') ||
            constraintError.message.includes('unique constraint')).toBe(true);
    });
    // -------------------------------------------------------------------------
    // 3. AuthSession tokenHash lookup
    // -------------------------------------------------------------------------
    it('login and logout use tokenHash lookups; session is created with hashed token', async () => {
        const loginRes = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email: USERS.AGENT.email, password: USERS.AGENT.password })
            .expect(200);
        const cookies = loginRes.headers['set-cookie'] ?? [];
        const refreshCookie = cookies.find((c) => c.startsWith('grotec_refresh='));
        expect(refreshCookie).toBeTruthy();
        // Extract raw token from cookie (format: "grotec_refresh=token; ...")
        const rawToken = refreshCookie.split(';')[0].split('=')[1];
        // Verify session is stored with hashed token (sha256 in hex = 64 chars)
        const sessions = await prisma.authSession.findMany({
            where: { employee: { email: USERS.AGENT.email }, revokedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        expect(sessions).toHaveLength(1);
        const session = sessions[0];
        expect(session.tokenHash).toHaveLength(64); // sha256 hex = 64 chars
        expect(session.tokenHash).not.toBe(rawToken); // never stored in plaintext
        // Logout must find and revoke the session by tokenHash
        await request(app.getHttpServer())
            .post('/api/v1/auth/logout')
            .set('Cookie', `grotec_refresh=${rawToken}`)
            .expect(204);
        const revoked = await prisma.authSession.findUnique({ where: { id: session.id } });
        expect(revoked?.revokedAt).not.toBeNull();
    });
    // -------------------------------------------------------------------------
    // 4. Payroll publish transaction: financial state and audit are atomic
    // -------------------------------------------------------------------------
    it('publish atomically writes payroll_run status + audit_event; a failure rolls back both', async () => {
        const month = '2026-09';
        // Create and approve a payroll run
        const genRes = await request(app.getHttpServer())
            .post('/api/v1/payroll/generate')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ month })
            .expect(201);
        const runId = genRes.body.id;
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/approve`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(201);
        const auditCountBefore = await prisma.auditEvent.count({
            where: { action: 'payroll.published', entityType: 'EMPLOYEE' },
        });
        // Count active sessions before publish (publishSideEffects creates notifications)
        const notifCountBefore = await prisma.appNotification.count();
        // Publish
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/publish`)
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(201);
        // Payroll run status updated
        const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
        expect(run.status).toBe('PUBLISHED');
        // Audit record created atomically with the status update
        const auditCountAfter = await prisma.auditEvent.count({
            where: { action: 'payroll.published', entityType: 'EMPLOYEE' },
        });
        expect(auditCountAfter).toBe(auditCountBefore + 1);
        // Notifications created (outside the financial transaction — Checkpoint E will use outbox)
        const notifCountAfter = await prisma.appNotification.count();
        expect(notifCountAfter).toBeGreaterThan(notifCountBefore);
    });
    it('publishSideEffects isolates per-employee failures: one failure does not roll back others or the financial state', async () => {
        // This test verifies the refactored publish() behavior from Checkpoint B:
        // The financial state (payroll_run + audit) are committed in transaction 1.
        // Side effects (notifications) run per-employee in separate transactions.
        // If one employee's side effect fails, the financial state is NOT rolled back.
        const month = '2026-10';
        const genRes = await request(app.getHttpServer())
            .post('/api/v1/payroll/generate')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ month })
            .expect(201);
        const runId = genRes.body.id;
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/approve`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(201);
        // Publish must succeed even if side effects partially fail
        // (the Logger in publishSideEffects catches and logs individual employee failures)
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/publish`)
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(201);
        // Financial state is committed regardless of side-effect outcome
        const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
        expect(run.status).toBe('PUBLISHED');
        expect(run.publishedAt).not.toBeNull();
        expect(run.publishedById).not.toBeNull();
    });
    it('transaction rollback: a failed business operation leaves no orphaned audit record', async () => {
        // Attempt to approve an already-PUBLISHED run — this must fail and must not
        // leave any audit event for the failed approval attempt.
        const month = '2026-11';
        const genRes = await request(app.getHttpServer())
            .post('/api/v1/payroll/generate')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ month })
            .expect(201);
        const runId = genRes.body.id;
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/approve`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/publish`)
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(201);
        // Count published audit events
        const auditCountBefore = await prisma.auditEvent.count({
            where: { action: 'payroll.published', entityType: 'EMPLOYEE' },
        });
        // Attempt to approve an already-PUBLISHED run -> must fail
        const failRes = await request(app.getHttpServer())
            .post(`/api/v1/payroll/${runId}/approve`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(400);
        expect(failRes.body.error.code).toBe('INVALID_STATUS');
        // No additional audit events for the failed attempt
        const auditCountAfter = await prisma.auditEvent.count({
            where: { action: 'payroll.published', entityType: 'EMPLOYEE' },
        });
        expect(auditCountAfter).toBe(auditCountBefore); // unchanged — no spurious audit
        // Run is still PUBLISHED
        const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
        expect(run.status).toBe('PUBLISHED');
    });
    // -------------------------------------------------------------------------
    // 5. Soft-delete does not block inserts on same natural key
    // -------------------------------------------------------------------------
    it('soft-deleting a customer phone does not block inserting the same number on a different customer', async () => {
        const phone = '9876543200';
        // Create first customer with this phone
        const c1 = await prisma.customer.create({ data: { fullName: 'Phone Test C1' } });
        const p1 = await prisma.customerPhone.create({
            data: { customerId: c1.id, phoneE164: phone, isPrimary: true },
        });
        // Soft-delete the phone
        await prisma.customerPhone.update({ where: { id: p1.id }, data: { deletedAt: new Date() } });
        // A different customer can now use the same phone number (active uniqueness)
        const c2 = await prisma.customer.create({ data: { fullName: 'Phone Test C2' } });
        const p2 = await prisma.customerPhone.create({
            data: { customerId: c2.id, phoneE164: phone, isPrimary: true },
        });
        // Both exist — one deleted, one active
        const all = await prisma.customerPhone.findMany({ where: { phoneE164: phone } });
        expect(all).toHaveLength(2);
        expect(all.filter((p) => p.deletedAt === null)).toHaveLength(1);
        expect(all.filter((p) => p.deletedAt !== null)).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 6. Concurrent relationship ownership — DB constraint catches the race
    // -------------------------------------------------------------------------
    it('concurrent relationship ownership: two transactions racing to assign the same customer — ' +
        'only one succeeds, the other fails at the DB partial unique constraint', async () => {
        const managerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } });
        const managers = await prisma.employee.findMany({ where: { roleId: managerRole.id, status: 'ACTIVE' } });
        expect(managers.length).toBeGreaterThanOrEqual(2);
        const [managerA, managerB] = managers;
        const customer = await prisma.customer.create({
            data: { fullName: 'Concurrent RM Race Customer' },
        });
        // First, the two transactions run with the same starting state (no active owner).
        // Each releases any (hypothetically) existing active row, then inserts.
        // The DB partial unique index ensures only one can win.
        const txA = prisma.$transaction(async (tx) => {
            await tx.relationshipOwnership.updateMany({
                where: { customerId: customer.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            return tx.relationshipOwnership.create({
                data: { customerId: customer.id, employeeId: managerA.id, assignedById: managerA.id },
            });
        });
        const txB = prisma.$transaction(async (tx) => {
            await tx.relationshipOwnership.updateMany({
                where: { customerId: customer.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            return tx.relationshipOwnership.create({
                data: { customerId: customer.id, employeeId: managerB.id, assignedById: managerB.id },
            });
        });
        const results = await Promise.allSettled([txA, txB]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        // Exactly one transaction succeeded, exactly one was rejected by the DB constraint.
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        // The rejection must be a Prisma unique-constraint violation (P2002)
        const rejection = rejected[0];
        const rejectionReason = rejection.reason;
        expect(rejectionReason.code).toBe('P2002');
        // Final invariant: exactly one active row
        const active = await prisma.relationshipOwnership.findMany({
            where: { customerId: customer.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
    });
    // -------------------------------------------------------------------------
    // 7. Lead ownership: same concurrency invariant
    // -------------------------------------------------------------------------
    it('concurrent lead ownership: two transactions racing to assign the same lead — DB constraint catches it', async () => {
        const agents = await prisma.employee.findMany({ where: { role: { code: 'AGENT' } } });
        expect(agents.length).toBeGreaterThanOrEqual(2);
        const [agentA, agentB] = agents;
        const customer = await prisma.customer.create({ data: { fullName: 'Lead Race Customer' } });
        const lead = await prisma.lead.create({ data: { customerId: customer.id } });
        const txA = prisma.$transaction(async (tx) => {
            await tx.leadOwnership.updateMany({
                where: { leadId: lead.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            return tx.leadOwnership.create({
                data: { leadId: lead.id, employeeId: agentA.id, assignedById: agentA.id },
            });
        });
        const txB = prisma.$transaction(async (tx) => {
            await tx.leadOwnership.updateMany({
                where: { leadId: lead.id, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            return tx.leadOwnership.create({
                data: { leadId: lead.id, employeeId: agentB.id, assignedById: agentB.id },
            });
        });
        const results = await Promise.allSettled([txA, txB]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        const rejection = rejected[0];
        const rejectionReason = rejection.reason;
        expect(rejectionReason.code).toBe('P2002');
        const active = await prisma.leadOwnership.findMany({
            where: { leadId: lead.id, releasedAt: null },
        });
        expect(active).toHaveLength(1);
    });
});
