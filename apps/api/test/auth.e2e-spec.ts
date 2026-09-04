import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginToken, resetData, uniqueEmail, USERS, type TestUser } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('auth', () => {
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

  it('logs in and returns access token + refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: USERS.AGENT.email, password: USERS.AGENT.password })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.employee.email).toBe(USERS.AGENT.email);
    expect(res.body.employee.roleCode).toBe('AGENT');
    expect(res.body.employee.permissions).toContain('customer.create');
    expect((res.headers['set-cookie'] ?? []).some((c) => c.startsWith('grotec_refresh='))).toBe(true);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost-1@grotec.local', password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an inactive account', async () => {
    const founder = await loginToken(app, USERS.FOUNDER);
    const created = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${founder}`)
      .send({ email: uniqueEmail('temp-inactive'), fullName: 'Temp Inactive', roleId: await roleIdOf('AGENT'), password: 'TempPass1' })
      .expect(201);
    const id = (created.body as { employee: { id: string } }).employee.id;
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${id}/deactivate`)
      .set('Authorization', `Bearer ${founder}`)
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: (created.body as { employee: { email: string } }).employee.email, password: 'TempPass1' })
      .expect(401);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('requires a token for /auth/me', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('returns the principal from /auth/me', async () => {
    const token = await loginToken(app, USERS.AGENT);
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(USERS.AGENT.email);
    expect(res.body.roleCode).toBe('AGENT');
  });

  it('rotates refresh tokens and rejects a reused token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: USERS.AGENT.email, password: USERS.AGENT.password })
      .expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0] as string;

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect(rotated.body.accessToken).toBeTruthy();

    // Reusing the old (rotated) token must fail.
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('logs out and invalidates the session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: USERS.AGENT.email, password: USERS.AGENT.password })
      .expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0] as string;
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('rate-limits repeated login failures', async () => {
    const email = 'rate-limited@grotec.local';
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong' })
      .expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  async function roleIdOf(code: string): Promise<string> {
    const role = await prisma.role.findUnique({ where: { code } });
    if (!role) throw new Error(`role ${code} missing`);
    return role.id;
  }
});
