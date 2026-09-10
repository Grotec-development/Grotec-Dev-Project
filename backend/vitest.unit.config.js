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
      'src/modules/import/**/*.spec.js',
      'src/modules/reports/**/*.spec.js',
      'src/common/logging/**/*.spec.js',
      'src/common/idempotency/**/*.spec.js',
      'src/modules/calls/**/*.spec.js',
      'src/modules/attendance/**/*.spec.js',
      'src/modules/relationship/**/*.spec.js',
      'src/modules/leads/**/*.spec.js',
    ],
    testTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: 'verbose',
  },
});
