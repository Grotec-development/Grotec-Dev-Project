import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, loginToken, resetData, USERS } from "./helpers";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("attendance e2e & rbac", () => {
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

  it("allows agent to mark own attendance (pending approval)", async () => {
    const agentToken = await loginToken(app, USERS.AGENT);
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });

    const res = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ date: "2026-09-01", status: "PRESENT", notes: "Checked in on time" })
      .expect(201);

    expect(res.body.status).toBe("PRESENT");
    expect(res.body.approvalStatus).toBe("PENDING");
    expect(res.body.employeeId).toBe(agent.id);
  });

  it("allows delivery staff to mark own attendance (pending approval)", async () => {
    const deliveryToken = await loginToken(app, USERS.DELIVERY);
    const delivery = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.DELIVERY.email } });

    const res = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send({ date: "2026-09-01", status: "PRESENT", notes: "Delivery morning shift" })
      .expect(201);

    expect(res.body.status).toBe("PRESENT");
    expect(res.body.approvalStatus).toBe("PENDING");
    expect(res.body.employeeId).toBe(delivery.id);
  });

  it("blocks agent or delivery from approving attendance (403)", async () => {
    const agentToken = await loginToken(app, USERS.AGENT);
    const deliveryToken = await loginToken(app, USERS.DELIVERY);
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${fakeId}/approve`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${fakeId}/approve`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .expect(403);
  });

  it("allows manager to approve subordinate attendance but blocks approving founder attendance", async () => {
    const managerToken = await loginToken(app, USERS.MANAGER);
    const founderToken = await loginToken(app, USERS.FOUNDER);
    const agentToken = await loginToken(app, USERS.AGENT);

    const agentMark = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ date: "2026-09-02", status: "PRESENT" })
      .expect(201);

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/attendance/${agentMark.body.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(201);
    expect(approveRes.body.approvalStatus).toBe("APPROVED");

    const founderMark = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${founderToken}`)
      .send({ date: "2026-09-02", status: "PRESENT" })
      .expect(201);

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/attendance/${founderMark.body.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);
    expect(rejectRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });

  it("prevents agent and delivery from viewing each others attendance", async () => {
    const agentToken = await loginToken(app, USERS.AGENT);
    const delivery = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.DELIVERY.email } });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/attendance?employeeId=${delivery.id}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });
});
