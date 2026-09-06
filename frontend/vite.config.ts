import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The shared package ships CommonJS dist (for the Node API). The browser needs
// ESM, and the package has no Node-only deps, so alias straight to its TS source.
const sharedSource = fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@grotec/shared': sharedSource,
    },
  },
  build: {
    // Never ship source maps to production — they expose your source tree.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the monolith 550 KB bundle into independently-cacheable chunks.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    globals: true,
  },
});
