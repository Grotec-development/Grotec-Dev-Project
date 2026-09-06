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
export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set — copy backend/.env.example to backend/.env');

  process.env.DATABASE_URL = testUrl;

  // Deterministic, fast mock-dialer timing for integration tests; the
  // background status poller is disabled (DIALER_SYNC_MS=0) so specs drive
  // reconciliation through GET /calls/:id instead of racing the loop.
  process.env.DIALER_RING_MS = '10';
  process.env.DIALER_CONNECT_MS = '20';
  process.env.DIALER_ANSWER_RATE = '1';
  process.env.DIALER_SYNC_MS = '0';

  const apiDir = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: testUrl };

  console.log('[global-setup] updating test database schema…');
  execSync('npx prisma db push --force-reset --skip-generate', { cwd: apiDir, env, stdio: 'inherit' });
  console.log('[global-setup] ensuring migration-only partial unique indexes…');
  await ensurePartialUniqueIndexes(testUrl);
  console.log('[global-setup] seeding test database…');
  execSync('npx tsx prisma/seed.ts', { cwd: apiDir, env, stdio: 'inherit' });
  console.log('[global-setup] ready');
}

/**
 * The Prisma schema cannot express partial unique indexes. Some invariants are
 * enforced by migration SQL only. This helper re-creates them on the test
 * database after `prisma db push`. Production deploys run `prisma migrate
 * deploy` which executes the same SQL.
 */
async function ensurePartialUniqueIndexes(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "relationship_ownership_current_customer_idx"
        ON "relationship_ownership" ("customer_id") WHERE "released_at" IS NULL;
    `);
  } finally {
    await client.end();
  }
}
