import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
// SWC (not esbuild) so Nest decorators emit design:paramtypes metadata.
export default defineConfig({
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
        environment: 'node',
        include: ['src/**/*.spec.js', 'test/**/*.e2e-spec.js'],
        globalSetup: ['test/global-setup.js'],
        hookTimeout: 120_000,
        testTimeout: 30_000,
        fileParallelism: false,
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
        reporters: 'dot',
    },
});
