import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, loginToken, resetData, USERS } from "./helpers";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("leave e2e & rbac", () => {
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

  it("allows agent to apply for leave with status PENDING", async () => {
    const agentToken = await loginToken(app, USERS.AGENT);
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });
    const leaveType = await prisma.leaveType.findFirstOrThrow({ where: { code: "CASUAL" } });

    const res = await request(app.getHttpServer())
      .post("/api/v1/leave/apply")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        daysCount: 2,
        reason: "Personal family event",
      })
      .expect(201);

    expect(res.body.status).toBe("PENDING");
    expect(res.body.employeeId).toBe(agent.id);
  });

  it("blocks delivery staff from approving leave (403)", async () => {
    const deliveryToken = await loginToken(app, USERS.DELIVERY);
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await request(app.getHttpServer())
      .post(`/api/v1/leave/applications/${fakeId}/approve`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .expect(403);
  });

  it("allows manager to approve subordinate leave but blocks approving founder leave", async () => {
    const managerToken = await loginToken(app, USERS.MANAGER);
    const founderToken = await loginToken(app, USERS.FOUNDER);
    const agentToken = await loginToken(app, USERS.AGENT);
    const leaveType = await prisma.leaveType.findFirstOrThrow({ where: { code: "CASUAL" } });

    // Agent applies
    const agentLeave = await request(app.getHttpServer())
      .post("/api/v1/leave/apply")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: "2026-10-10",
        endDate: "2026-10-10",
        daysCount: 1,
        reason: "Doctor appointment",
      })
      .expect(201);

    // Manager approves agent leave
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/leave/applications/${agentLeave.body.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(201);
    expect(approveRes.body.status).toBe("APPROVED");

    // Founder cannot apply for leave (no leave.apply permission -> 403)
    await request(app.getHttpServer())
      .post("/api/v1/leave/apply")
      .set("Authorization", `Bearer ${founderToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        daysCount: 1,
        reason: "Board meeting",
      })
      .expect(403);

    // Manager cannot approve higher rank (e.g. Founder) -> 403 ROLE_HIERARCHY_FORBIDDEN
    const founderEmp = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } });
    const directFounderLeave = await prisma.leaveApplication.create({
      data: {
        employeeId: founderEmp.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-10-12"),
        endDate: new Date("2026-10-12"),
        daysCount: 1,
        reason: "Owner out of office",
        status: "PENDING",
      },
    });

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/leave/applications/${directFounderLeave.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);
    expect(rejectRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });

  it("blocks delivery staff from viewing another employee leave balance", async () => {
    const deliveryToken = await loginToken(app, USERS.DELIVERY);
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/leave/balances?employeeId=${agent.id}`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });
});
