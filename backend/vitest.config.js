import dns from 'node:dns';
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import { execSync } from 'node:child_process';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

function isTestDbReachable() {
    if (process.env.SKIP_E2E === 'true') return false;
    if (process.env.RUN_E2E === 'true') return true;
    try {
        execSync('nc -z -w 1 127.0.0.1 5432', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const hasTestDb = isTestDbReachable();

// SWC (not esbuild) so Nest decorators emit design:paramtypes metadata.
export default defineConfig({
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
        environment: 'node',
        setupFiles: ['./test/setup.js'],
        include: hasTestDb
            ? ['src/**/*.spec.js', 'test/**/*.e2e-spec.js']
            : ['src/**/*.spec.js', '!src/qa-*.spec.js'],
        globalSetup: hasTestDb ? ['test/global-setup.js'] : [],
        hookTimeout: 120_000,
        testTimeout: 30_000,
        fileParallelism: false,
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
        reporters: 'dot',
    },
});
