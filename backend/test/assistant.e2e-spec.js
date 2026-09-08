import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ASSISTANT_LLM_PROVIDER } from '../src/modules/assistant/llm/llm-provider';
import { createCustomerAs, loginToken, resetData, uniqueEmail, USERS } from './helpers';
const stubLlm = {
    available: true,
    model: 'test-stub',
    complete: async () => 'Use Azos at sowing, then repeat at tillering. Follow the Grotec label.',
};
async function createAppWithLlm(provider) {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ASSISTANT_LLM_PROVIDER)
        .useValue(provider)
        .compile();
    const app = moduleRef.createNestApplication();
    await configureApp(app, { swagger: false });
    await app.init();
    return { app, prisma: app.get(PrismaService) };
}
describe('assistant — AI chat + Knowledge Base guidance content', () => {
    let app;
    let prisma;
    let noKeyApp;
    let founderToken;
    let managerToken;
    let agentToken;
    let staffToken;
    beforeAll(async () => {
        const stub = await createAppWithLlm(stubLlm);
        app = stub.app;
        prisma = stub.prisma;
        const noKeyStub = {
            available: false,
            model: 'no-key-stub',
            complete: async () => { throw new Error('LLM unavailable'); },
        };
        const noKey = await createAppWithLlm(noKeyStub);
        noKeyApp = noKey.app;
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
    async function seedGuidanceRow() {
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
        return { id: res.body.id, cropId: crop.id };
    }
    it('answers a question using retrieved guidance + the LLM, and returns sources', async () => {
        const row = await seedGuidanceRow();
        const res = await request(app.getHttpServer())
            .post('/api/v1/assistant/chat')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ message: 'What should I recommend for leaf yellowing on paddy?', cropId: row.cropId })
            .expect(201);
        const body = res.body;
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
        expect(audit?.meta).toMatchObject({ status: 'answered' });
    });
    it('falls back gracefully when the LLM is not configured (no API key)', async () => {
        const res = await request(noKeyApp.getHttpServer())
            .post('/api/v1/assistant/chat')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ message: 'What should I recommend for rice?' })
            .expect(201);
        const body = res.body;
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
            .expect(200)).body;
        expect(agentList.some((g) => g.id === row.id)).toBe(false);
        expect(agentList.every((g) => g.isActive)).toBe(true);
        // Managers see the full catalog incl. retired rows when requested.
        const managerList = (await request(app.getHttpServer())
            .get('/api/v1/assistant/guidance?includeInactive=true')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200)).body;
        expect(managerList.some((g) => g.id === row.id)).toBe(true);
        const managerActive = (await request(app.getHttpServer())
            .get('/api/v1/assistant/guidance')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200)).body;
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
        const createdBody = created.body;
        // PRD §6.5.2: the problem type + crop category travel with the entry.
        expect(createdBody.problemType).toBe('NUTRIENT_DEFICIENCY');
        expect(createdBody.crop.category).toBe('FIELD');
        const list = (await request(app.getHttpServer()).get('/api/v1/assistant/guidance').set('Authorization', `Bearer ${founderToken}`).expect(200)).body;
        expect(list.some((g) => g.id === row.id)).toBe(true);
        // Browse filters by problem/issue type (the KB quick-lookup path).
        const byType = (await request(app.getHttpServer())
            .get('/api/v1/assistant/guidance?type=NUTRIENT_DEFICIENCY')
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(200)).body;
        expect(byType.some((g) => g.id === row.id)).toBe(true);
        expect(byType.every((g) => g.problemType === 'NUTRIENT_DEFICIENCY')).toBe(true);
        const otherType = (await request(app.getHttpServer())
            .get('/api/v1/assistant/guidance?type=PEST')
            .set('Authorization', `Bearer ${founderToken}`)
            .expect(200)).body;
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
        expect(patched.body.usageGuidance).toContain('Updated guidance');
        expect(patched.body.problemType).toBe('DISEASE');
        // Editing a missing row is a clean 404.
        await request(app.getHttpServer())
            .patch('/api/v1/assistant/guidance/00000000-0000-4000-8000-000000000000')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ notes: 'nope' })
            .expect(404);
    });
    it('authorization: an agent can pull their own customer into the chat context, but not another agent\'s', async () => {
        const ownCustomerId = await createCustomerAs(app, agentToken, 'Own Farmer', '9876547001');
        const own = await request(app.getHttpServer())
            .post('/api/v1/assistant/chat')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ message: 'How is this farmer doing on rice?', customerId: ownCustomerId })
            .expect(201);
        expect(own.body.status).toBe('answered');
        // A second agent owns a different customer — the first agent must not be
        // able to pull that customer's data into the assistant chat.
        const agentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'AGENT' } });
        const email = uniqueEmail('agent2');
        await request(app.getHttpServer())
            .post('/api/v1/employees')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ email, fullName: 'Agent Two', roleId: agentRole.id, password: 'TempPass1' })
            .expect(201);
        const agent2Token = await loginToken(app, { email, password: 'TempPass1', roleCode: 'AGENT' });
        const otherCustomerId = await createCustomerAs(app, agent2Token, 'Other Agent Farmer', '9876547002');
        const res = await request(app.getHttpServer())
            .post('/api/v1/assistant/chat')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ message: 'How is this farmer doing on rice?', customerId: otherCustomerId })
            .expect(403);
        expect(res.body.error.code).toBe('CUSTOMER_ACCESS_FORBIDDEN');
        // A manager (broader visibility scope) can still pull the same customer.
        await request(app.getHttpServer())
            .post('/api/v1/assistant/chat')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ message: 'How is this farmer doing on rice?', customerId: otherCustomerId })
            .expect(201);
    });
});
