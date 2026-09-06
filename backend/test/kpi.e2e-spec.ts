import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, loginToken, resetData, USERS } from "./helpers";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("kpi e2e & rbac", () => {
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

  it("allows manager to configure KPI target for agent but blocks configuring for founder", async () => {
    const managerToken = await loginToken(app, USERS.MANAGER);
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });
    const founder = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.FOUNDER.email } });

    // Target for agent -> 201
    const res = await request(app.getHttpServer())
      .post("/api/v1/kpi/targets")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        employeeId: agent.id,
        period: "2026-09",
        metric: "CALLS_DIALED",
        targetValue: 80,
        weight: 1,
      })
      .expect(201);
    expect(res.body.metric).toBe("CALLS_DIALED");

    // Target for founder -> 403 ROLE_HIERARCHY_FORBIDDEN
    const blockedRes = await request(app.getHttpServer())
      .post("/api/v1/kpi/targets")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        employeeId: founder.id,
        period: "2026-09",
        metric: "CALLS_DIALED",
        targetValue: 100,
      })
      .expect(403);
    expect(blockedRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });

  it("scopes KPI score visibility between peers", async () => {
    const agentToken = await loginToken(app, USERS.AGENT);
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });
    const delivery = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.DELIVERY.email } });

    // Agent views own score -> 200
    const ownRes = await request(app.getHttpServer())
      .get(`/api/v1/kpi/scores/${agent.id}?period=2026-09`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(200);
    expect(ownRes.body.employeeId).toBe(agent.id);

    // Agent tries to view delivery score -> 403 ROLE_HIERARCHY_FORBIDDEN
    const peerRes = await request(app.getHttpServer())
      .get(`/api/v1/kpi/scores/${delivery.id}?period=2026-09`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(403);
    expect(peerRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });

  it("allows manager to freeze subordinate score but blocks freezing own score", async () => {
    const managerToken = await loginToken(app, USERS.MANAGER);
    const manager = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.MANAGER.email } });
    const agent = await prisma.employee.findUniqueOrThrow({ where: { email: USERS.AGENT.email } });

    // Manager freezes Agent score -> 201/200
    const freezeRes = await request(app.getHttpServer())
      .post(`/api/v1/kpi/scores/${agent.id}/freeze`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        period: "2026-09",
        reviewNotes: "Strong call volume and conversion",
      })
      .expect(201);
    expect(freezeRes.body.isFrozen).toBe(true);

    // Manager tries to freeze own score -> 403 ROLE_HIERARCHY_FORBIDDEN
    const selfRes = await request(app.getHttpServer())
      .post(`/api/v1/kpi/scores/${manager.id}/freeze`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        period: "2026-09",
        reviewNotes: "Self appraisal",
      })
      .expect(403);
    expect(selfRes.body.error.code).toBe("ROLE_HIERARCHY_FORBIDDEN");
  });
});
