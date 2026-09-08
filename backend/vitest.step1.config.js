/**
 * ISOLATED Vitest config — Step 1 regression specs ONLY.
 *
 * Why this exists
 * ---------------
 * The project config (vitest.config.js) registers `globalSetup: test/global-setup.js`,
 * which runs `prisma db push --force-reset` and therefore WIPES whatever database
 * TEST_DATABASE_URL points at. The two Step 1 specs below need no database at all —
 * PrismaService is stubbed in both — so requiring a disposable database just to assert
 * an HTTP status code and a CORS header would be a destructive, unnecessary dependency.
 *
 * This config runs those two files with no globalSetup and no database of any kind.
 *
 * Scope guarantees
 * ----------------
 * - Vitest auto-discovers `vitest.config.js` only; this file is used solely when passed
 *   explicitly via `--config`, so it can never be picked up by `npm test` / `npm run test:api`.
 * - No npm script references it. The project config is untouched and still enforces
 *   globalSetup for the real e2e suite.
 * - Not matched by tsconfig `include` (src/**\/* and prisma/seed.js), so it never reaches
 *   the build or the Docker image.
 *
 * Usage (from backend/):
 *   npx vitest run --config vitest.step1.config.js
 */
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // SWC (not esbuild) so Nest decorators emit design:paramtypes metadata —
    // same plugin and options as the project config.
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
        environment: 'node',
        include: [
            'src/app-setup.spec.js',
            'src/modules/health/health.controller.spec.js',
        ],
        // Deliberately NO globalSetup — see the note above.
        testTimeout: 30_000,
        fileParallelism: false,
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
        reporters: 'verbose',
    },
});
