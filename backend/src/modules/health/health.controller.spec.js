/**
 * Step 1 regression tests — health endpoint HTTP status codes.
 *
 * Boots the real HealthController through the real Nest HTTP pipeline and the
 * real configureApp(), with PrismaService replaced by a stub. No database is
 * required: the only thing under test is what the controller does when the DB
 * probe succeeds versus throws.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { HealthController } from './health.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { configureApp } from '../../app-setup';

let app;

/** Boots the real controller with a stubbed database probe. */
async function bootWithDb({ reachable }) {
    const prismaStub = {
        $queryRaw: async () => {
            if (!reachable) throw new Error('ECONNREFUSED: database unreachable');
            return [{ '?column?': 1 }];
        },
    };
    const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
        controllers: [HealthController],
        providers: [{ provide: PrismaService, useValue: prismaStub }],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, { swagger: false });
    await app.init();
    return app;
}

afterEach(async () => {
    if (app) await app.close();
    app = undefined;
});

describe('GET /api/v1/health', () => {
    it('returns HTTP 200 when the database probe succeeds', async () => {
        const httpServer = (await bootWithDb({ reachable: true })).getHttpServer();
        const res = await request(httpServer).get('/api/v1/health');
        expect(res.status).toBe(200);
    });

    it('returns HTTP 503 when the database probe fails', async () => {
        const httpServer = (await bootWithDb({ reachable: false })).getHttpServer();
        const res = await request(httpServer).get('/api/v1/health');
        expect(res.status).toBe(503);
    });

    it('keeps the pre-existing response body on the healthy path', async () => {
        const httpServer = (await bootWithDb({ reachable: true })).getHttpServer();
        const res = await request(httpServer).get('/api/v1/health');
        expect(res.body).toEqual({ status: 'ok', db: 'up' });
    });

    it('keeps the pre-existing response body on the degraded path', async () => {
        const httpServer = (await bootWithDb({ reachable: false })).getHttpServer();
        const res = await request(httpServer).get('/api/v1/health');
        // Body shape is unchanged from before Step 1 — only the status code moved.
        expect(res.body).toEqual({ status: 'degraded', db: 'down' });
    });

    it('is reachable without authentication (@Public is still applied)', async () => {
        const httpServer = (await bootWithDb({ reachable: true })).getHttpServer();
        const res = await request(httpServer).get('/api/v1/health');
        expect(res.status).not.toBe(401);
    });
});
