/**
 * Step 1 regression tests — CORS origin policy configured by configureApp().
 *
 * Exercises the real configureApp() through the real Nest HTTP pipeline, using
 * the health route purely as a probe endpoint. PrismaService is stubbed, so no
 * database is required.
 *
 * Guards the fix for the previous `origin: true` fallback, which reflected back
 * ANY requesting origin while credentials were enabled.
 */
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { HealthController } from './modules/health/health.controller';
import { PrismaService } from './common/prisma/prisma.service';
import { configureApp } from './app-setup';

let app;
let originalCorsOrigins;

beforeAll(() => {
    originalCorsOrigins = process.env.CORS_ORIGINS;
});

afterAll(() => {
    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;
});

afterEach(async () => {
    if (app) await app.close();
    app = undefined;
});

/** Boots the real app wiring with CORS_ORIGINS set (or deliberately absent). */
async function bootWithCors(corsOrigins) {
    if (corsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = corsOrigins;
    const prismaStub = { $queryRaw: async () => [{ '?column?': 1 }] };
    const moduleRef = await Test.createTestingModule({
        // ignoreEnvFile so backend/.env cannot leak a CORS_ORIGINS value into
        // the "not configured" cases below.
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
        controllers: [HealthController],
        providers: [{ provide: PrismaService, useValue: prismaStub }],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, { swagger: false });
    await app.init();
    return app;
}

/** Response header the browser uses to decide whether the origin is allowed. */
async function corsHeadersFor(nestApp, origin) {
    const res = await request(nestApp.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', origin);
    return {
        allowOrigin: res.headers['access-control-allow-origin'],
        allowCredentials: res.headers['access-control-allow-credentials'],
    };
}

describe('CORS — CORS_ORIGINS configured (explicit allow-list)', () => {
    it('allows a configured origin', async () => {
        const a = await bootWithCors('http://localhost:5173');
        expect((await corsHeadersFor(a, 'http://localhost:5173')).allowOrigin).toBe('http://localhost:5173');
    });

    it('rejects an origin that is not on the list', async () => {
        const a = await bootWithCors('http://localhost:5173');
        expect((await corsHeadersFor(a, 'https://evil.example.com')).allowOrigin).toBeUndefined();
    });

    it('rejects a localhost port that is not on the list', async () => {
        // Proves the configured list still wins over the development fallback.
        const a = await bootWithCors('http://localhost:5173');
        expect((await corsHeadersFor(a, 'http://localhost:9999')).allowOrigin).toBeUndefined();
    });

    it('honours a comma-separated list', async () => {
        const a = await bootWithCors('http://localhost:5173, https://app.grotec.example');
        expect((await corsHeadersFor(a, 'http://localhost:5173')).allowOrigin).toBe('http://localhost:5173');
        expect((await corsHeadersFor(a, 'https://app.grotec.example')).allowOrigin).toBe('https://app.grotec.example');
        expect((await corsHeadersFor(a, 'https://other.example')).allowOrigin).toBeUndefined();
    });

    it('preserves credentialed CORS for an allowed origin', async () => {
        const a = await bootWithCors('http://localhost:5173');
        expect((await corsHeadersFor(a, 'http://localhost:5173')).allowCredentials).toBe('true');
    });
});

describe('CORS — CORS_ORIGINS absent (development fallback)', () => {
    it('allows localhost', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'http://localhost:5173')).allowOrigin).toBe('http://localhost:5173');
    });

    it('allows 127.0.0.1', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'http://127.0.0.1:5173')).allowOrigin).toBe('http://127.0.0.1:5173');
    });

    it('allows the IPv6 loopback [::1]', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'http://[::1]:5173')).allowOrigin).toBe('http://[::1]:5173');
    });

    it('allows any localhost port, and localhost with no port', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'http://localhost:3000')).allowOrigin).toBe('http://localhost:3000');
        expect((await corsHeadersFor(a, 'http://localhost:4200')).allowOrigin).toBe('http://localhost:4200');
        expect((await corsHeadersFor(a, 'http://localhost')).allowOrigin).toBe('http://localhost');
        expect((await corsHeadersFor(a, 'https://localhost:5173')).allowOrigin).toBe('https://localhost:5173');
    });

    it('rejects arbitrary external origins', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'https://evil.example.com')).allowOrigin).toBeUndefined();
        expect((await corsHeadersFor(a, 'http://203.0.113.10')).allowOrigin).toBeUndefined();
    });

    it('rejects hostile look-alike origins', async () => {
        const a = await bootWithCors(undefined);
        for (const origin of [
            'http://localhost.evil.com',
            'http://notlocalhost:5173',
            'http://sub.localhost:5173',
            'http://127.0.0.1.evil.com',
            'http://evil.com/localhost',
        ]) {
            expect((await corsHeadersFor(a, origin)).allowOrigin, `origin must be rejected: ${origin}`).toBeUndefined();
        }
    });

    it('still preserves credentialed CORS for an allowed local origin', async () => {
        const a = await bootWithCors(undefined);
        expect((await corsHeadersFor(a, 'http://localhost:5173')).allowCredentials).toBe('true');
    });
});
