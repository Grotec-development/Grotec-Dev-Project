import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ASSISTANT_LLM_PROVIDER, LlmProvider } from '../src/modules/assistant/llm/llm-provider';
import { createTestApp, loginToken, resetData, USERS } from './helpers';

const stubLlm: LlmProvider = {
  available: true,
  model: 'test-stub',
  complete: async () => 'Use Azos at sowing, then repeat at tillering. Follow the Grotec label.',
};

async function createAppWithLlm(provider: unknown): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ASSISTANT_LLM_PROVIDER)
    .useValue(provider)
    .compile();
  const app = moduleRef.createNestApplication();
  await configureApp(app, { swagger: false });
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

interface ChatBody {
  status: string;
  conversationId: string;
  answer?: string;
  sources?: Array<{ id: string; cropName: string; recommendedProducts: string[] }>;
}

describe('assistant — AI chat + Knowledge Base guidance content', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let noKeyApp: INestApplication;
  let founderToken: string;
  let managerToken: string;
  let agentToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const stub = await createAppWithLlm(stubLlm);
    app = stub.app;
    prisma = stub.prisma;
    const plain = await createTestApp();
    noKeyApp = plain.app;
    founderToken = await loginToken(app, USERS.FOUNDER);
    managerToken = await loginToken(app, USERS.MANAGER);
    agentToken = await loginToken(app, USERS.AGENT);
    staffToken = await loginToken(app, USERS.STAFF);
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
    await noKeyApp.close();
  });

  async function seedGuidanceRow(): Promise<{ id: string; cropId: string }> {
    const crop = await prisma.crop.findUniqueOrThrow({ where: { code: 'RICE' } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/assistant/guidance')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({
        cropId: crop.id,
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['leaf yellowing', 'nitrogen deficiency'],
        recommendedProducts: ['Azos', 'Bio Jeevan PF'],
        usageGuidance: 'Soil application at sowing; repeat at tillering per label.',
      })
      .expect(201);
    return { id: (res.body as { id: string }).id, cropId: crop.id };
  }

  it('answers a question using retrieved guidance + the LLM, and returns sources', async () => {
    const row = await seedGuidanceRow();
    const res = await request(app.getHttpServer())
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ message: 'What should I recommend for leaf yellowing on paddy?', cropId: row.cropId })
      .expect(201);
    const body = res.body as ChatBody;
    expect(body.status).toBe('answered');
    expect(body.answer).toContain('Azos');
    expect(body.conversationId).toBeTruthy();
    expect(body.sources?.length).toBeGreaterThan(0);
    const source = body.sources?.find((s) => s.id === row.id);
    expect(source?.cropName).toBe('Rice (Paddy)');
    expect(source?.recommendedProducts).toContain('Azos');

    // Every question+answer is audited under the acting employee.
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: 'ASSISTANT', action: 'assistant.chat', actorId: { not: null } }, orderBy: { createdAt: 'desc' } });
    expect(audit).toBeTruthy();
    expect(audit?.meta as { status?: string }).toMatchObject({ status: 'answered' });
  });

  it('falls back gracefully when the LLM is not configured (no API key)', async () => {
    const res = await request(noKeyApp.getHttpServer())
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ message: 'What should I recommend for rice?' })
      .expect(201);
    const body = res.body as ChatBody;
    expect(body.status).toBe('unavailable');
    expect(body.answer).toContain('unavailable');
    expect(body.sources).toHaveLength(0);
  });

  it('RBAC: staff cannot chat and agents cannot manage guidance content', async () => {
    await request(app.getHttpServer()).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${staffToken}`).send({ message: 'hi' }).expect(403);

    const crop = await prisma.crop.findUniqueOrThrow({ where: { code: 'WHEAT' } });
    await request(app.getHttpServer())
      .post('/api/v1/assistant/guidance')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ cropId: crop.id, problemKeywords: ['yellowing'], recommendedProducts: ['Azos'] })
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/assistant/guidance').set('Authorization', `Bearer ${staffToken}`).expect(403);
  });

  it('Knowledge Base browse: agents read active guidance; inactive rows are manager-only', async () => {
    const row = await seedGuidanceRow();
    // Retire the row (content managers can deactivate).
    await request(app.getHttpServer())
      .patch(`/api/v1/assistant/guidance/${row.id}`)
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ isActive: false })
      .expect(200);

    // Agents (telecallers) browse the Knowledge Base — active rows only, even
    // when includeInactive is attempted.
    const agentList = (await request(app.getHttpServer())
      .get('/api/v1/assistant/guidance?includeInactive=true')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200)).body as Array<{ id: string; isActive: boolean }>;
    expect(agentList.some((g) => g.id === row.id)).toBe(false);
    expect(agentList.every((g) => g.isActive)).toBe(true);

    // Managers see the full catalog incl. retired rows when requested.
    const managerList = (await request(app.getHttpServer())
      .get('/api/v1/assistant/guidance?includeInactive=true')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)).body as Array<{ id: string }>;
    expect(managerList.some((g) => g.id === row.id)).toBe(true);
    const managerActive = (await request(app.getHttpServer())
      .get('/api/v1/assistant/guidance')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)).body as Array<{ id: string }>;
    expect(managerActive.some((g) => g.id === row.id)).toBe(false);
  });

  it('guidance content: founder creates, lists and edits rows; manager can read', async () => {
    const crop = await prisma.crop.findUniqueOrThrow({ where: { code: 'RICE' } });
    const row = await seedGuidanceRow();
    const created = await request(app.getHttpServer())
      .post('/api/v1/assistant/guidance')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({
        cropId: crop.id,
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['leaf yellowing', 'nitrogen deficiency'],
        recommendedProducts: ['Azos', 'Bio Jeevan PF'],
        usageGuidance: 'Soil application at sowing; repeat at tillering per label.',
      })
      .expect(201);
    const createdBody = created.body as { id: string; problemType: string; crop: { name: string; category: string | null } };
    // PRD §6.5.2: the problem type + crop category travel with the entry.
    expect(createdBody.problemType).toBe('NUTRIENT_DEFICIENCY');
    expect(createdBody.crop.category).toBe('FIELD');

    const list = (await request(app.getHttpServer()).get('/api/v1/assistant/guidance').set('Authorization', `Bearer ${founderToken}`).expect(200)).body as Array<{ id: string }>;
    expect(list.some((g) => g.id === row.id)).toBe(true);

    // Browse filters by problem/issue type (the KB quick-lookup path).
    const byType = (await request(app.getHttpServer())
      .get('/api/v1/assistant/guidance?type=NUTRIENT_DEFICIENCY')
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200)).body as Array<{ id: string; problemType: string }>;
    expect(byType.some((g) => g.id === row.id)).toBe(true);
    expect(byType.every((g) => g.problemType === 'NUTRIENT_DEFICIENCY')).toBe(true);
    const otherType = (await request(app.getHttpServer())
      .get('/api/v1/assistant/guidance?type=PEST')
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200)).body as Array<{ id: string }>;
    expect(otherType.some((g) => g.id === row.id)).toBe(false);

    // A bogus type is rejected by DTO validation on write paths.
    await request(app.getHttpServer())
      .post('/api/v1/assistant/guidance')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ cropId: crop.id, problemType: 'FUNGUS', problemKeywords: ['spots'], recommendedProducts: ['Azos'] })
      .expect(400);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/assistant/guidance/${row.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ usageGuidance: 'Updated guidance: apply per label at sowing and tillering.', problemType: 'DISEASE' })
      .expect(200);
    expect((patched.body as { usageGuidance: string }).usageGuidance).toContain('Updated guidance');
    expect((patched.body as { problemType: string }).problemType).toBe('DISEASE');

    // Editing a missing row is a clean 404.
    await request(app.getHttpServer())
      .patch('/api/v1/assistant/guidance/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ notes: 'nope' })
      .expect(404);
  });
});
