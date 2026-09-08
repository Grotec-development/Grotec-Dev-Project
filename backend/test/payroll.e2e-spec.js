import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, loginToken, resetData, USERS } from "./helpers";
describe("payroll e2e & rbac", () => {
    let app;
    let prisma;
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
    it("manager generates and approves payroll run", async () => {
        const managerToken = await loginToken(app, USERS.MANAGER);
        const genRes = await request(app.getHttpServer())
            .post("/api/v1/payroll/generate")
            .set("Authorization", `Bearer ${managerToken}`)
            .send({ month: "2026-08", notes: "August regular cycle" })
            .expect(201);
        expect(genRes.body.status).toBe("GENERATED");
        expect(genRes.body.month).toBe("2026-08");
        const approveRes = await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/approve`)
            .set("Authorization", `Bearer ${managerToken}`)
            .expect(201);
        expect(approveRes.body.status).toBe("APPROVED_LOCKED");
    });
    it("strictly restricts payroll publishing to Founder", async () => {
        const managerToken = await loginToken(app, USERS.MANAGER);
        const founderToken = await loginToken(app, USERS.FOUNDER);
        // Generate & approve run
        const genRes = await request(app.getHttpServer())
            .post("/api/v1/payroll/generate")
            .set("Authorization", `Bearer ${managerToken}`)
            .send({ month: "2026-07" })
            .expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/approve`)
            .set("Authorization", `Bearer ${managerToken}`)
            .expect(201);
        // Manager tries to publish -> 403
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/publish`)
            .set("Authorization", `Bearer ${managerToken}`)
            .expect(403);
        // Founder publishes -> 201/200
        const pubRes = await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/publish`)
            .set("Authorization", `Bearer ${founderToken}`)
            .expect(201);
        expect(pubRes.body.status).toBe("PUBLISHED");
    });
    it("scopes payslip viewing so peers cannot inspect each other", async () => {
        const founderToken = await loginToken(app, USERS.FOUNDER);
        const agentToken = await loginToken(app, USERS.AGENT);
        const delivery = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.DELIVERY.email } });
        // Generate, approve, and publish a run
        const genRes = await request(app.getHttpServer())
            .post("/api/v1/payroll/generate")
            .set("Authorization", `Bearer ${founderToken}`)
            .send({ month: "2026-06" })
            .expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/approve`)
            .set("Authorization", `Bearer ${founderToken}`)
            .expect(201);
        await request(app.getHttpServer())
            .post(`/api/v1/payroll/${genRes.body.id}/publish`)
            .set("Authorization", `Bearer ${founderToken}`)
            .expect(201);
        // Agent viewing own payslips
        const ownRes = await request(app.getHttpServer())
            .get("/api/v1/payroll/payslips")
            .set("Authorization", `Bearer ${agentToken}`)
            .expect(200);
        expect(Array.isArray(ownRes.body)).toBe(true);
        // Agent trying to view delivery payslips
        const peerRes = await request(app.getHttpServer())
            .get(`/api/v1/payroll/payslips?employeeId=${delivery.id}`)
            .set("Authorization", `Bearer ${agentToken}`)
            .expect(403);
        expect(peerRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
    });
    it("blocks manager from viewing founder salary revisions", async () => {
        const managerToken = await loginToken(app, USERS.MANAGER);
        const founder = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } });
        const res = await request(app.getHttpServer())
            .get(`/api/v1/payroll/salary-revisions/${founder.id}`)
            .set("Authorization", `Bearer ${managerToken}`)
            .expect(403);
        expect(res.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
    });
});
