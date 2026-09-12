/**
 * Isolated Vitest config for unit tests with ZERO database dependencies.
 * Deliberately omits globalSetup so neither Supabase nor TEST_DATABASE_URL is touched.
 */
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: [
      'src/app-setup.spec.js',
      'src/modules/health/**/*.spec.js',
      'src/modules/import/**/*.spec.js',
      'src/modules/reports/**/*.spec.js',
      'src/common/logging/**/*.spec.js',
      'src/common/idempotency/**/*.spec.js',
      'src/common/outbox/**/*.spec.js',
      'src/modules/calls/**/*.spec.js',
      'src/modules/attendance/**/*.spec.js',
      'src/modules/relationship/**/*.spec.js',
      'src/modules/leads/**/*.spec.js',
      'src/modules/leave/**/*.spec.js',
      'src/modules/payroll/**/*.spec.js',
    ],
    testTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: 'verbose',
  },
});
