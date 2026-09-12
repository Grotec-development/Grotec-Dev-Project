import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';
import { Client } from 'pg';
/**
 * Runs once per `vitest run`:
 * 1. Loads backend/.env
 * 2. Points DATABASE_URL at the TEST database (grotec_test)
 * 3. Applies Prisma schema (db push), then ensures migration-only partial unique
 *    indexes (which Prisma schema cannot express) are present.
 * 4. Seeds RBAC/demo data.
 * Workers inherit process.env, so the app under test talks only to the test DB.
 */
export default async function globalSetup() {
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl)
        throw new Error('TEST_DATABASE_URL is not set — copy backend/.env.example to backend/.env');
    // Both DATABASE_URL and DIRECT_URL must point at the test database: Prisma's
    // schema declares a directUrl (schema.prisma), and `prisma db push` connects
    // via directUrl when present. Redirecting DATABASE_URL alone left DIRECT_URL
    // pointed at whatever real database backend/.env configured — meaning
    // `--force-reset` was wiping that database, not grotec_test.
    process.env.DATABASE_URL = testUrl;
    process.env.DIRECT_URL = testUrl;
    // Deterministic, fast mock-dialer timing for integration tests; the
    // background status poller is disabled (DIALER_SYNC_MS=0) so specs drive
    // reconciliation through GET /calls/:id instead of racing the loop.
    process.env.DIALER_RING_MS = '10';
    process.env.DIALER_CONNECT_MS = '20';
    process.env.DIALER_ANSWER_RATE = '1';
    process.env.DIALER_SYNC_MS = '0';
    const apiDir = path.resolve(__dirname, '..');
    const env = { ...process.env, DATABASE_URL: testUrl };
    const probeClient = new Client({ connectionString: testUrl, connectionTimeoutMillis: 2000 });
    try {
        await probeClient.connect();
        await probeClient.end();
    } catch (err) {
        console.warn(`[global-setup] Test database at ${testUrl} is not reachable (${err.message}). Skipping db push and seed.`);
        return;
    }
    console.log('[global-setup] updating test database schema…');
    execSync('npx prisma db push --force-reset --skip-generate', { cwd: apiDir, env, stdio: 'inherit' });
    console.log('[global-setup] ensuring migration-only partial unique indexes…');
    await ensurePartialUniqueIndexes(testUrl);
    console.log('[global-setup] seeding test database…');
    execSync('node prisma/seed.js', { cwd: apiDir, env, stdio: 'inherit' });
    console.log('[global-setup] ready');
}
/**
 * The Prisma schema cannot express partial unique indexes. Some invariants are
 * enforced by migration SQL only. This helper re-creates them on the test
 * database after `prisma db push`. Production deploys run `prisma migrate
 * deploy` which executes the same SQL.
 */
async function ensurePartialUniqueIndexes(databaseUrl) {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
    try {
        await client.connect();
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "relationship_ownership_current_customer_idx"
        ON "relationship_ownership" ("customer_id") WHERE "released_at" IS NULL;
    `);
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.warn('[global-setup] Database is not reachable at ' + databaseUrl + '; skipping index creation.');
            return;
        }
        throw err;
    } finally {
        try { await client.end(); } catch (_) {}
    }
}
