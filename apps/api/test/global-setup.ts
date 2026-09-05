import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Runs once per `vitest run`:
 * 1. Loads apps/api/.env
 * 2. Points DATABASE_URL at the TEST database (grotec_test)
 * 3. Applies migrations and seeds RBAC/demo data there
 * Workers inherit process.env, so the app under test talks only to the test DB.
 */
export default function globalSetup(): void {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set — copy apps/api/.env.example to apps/api/.env');

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
  console.log('[global-setup] seeding test database…');
  execSync('npx tsx prisma/seed.ts', { cwd: apiDir, env, stdio: 'inherit' });
  console.log('[global-setup] ready');
}
