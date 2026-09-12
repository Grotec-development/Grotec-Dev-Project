import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The shared package ships CommonJS dist (for the Node API). The browser needs
// ESM, and the package has no Node-only deps, so alias straight to its source.
// The sources are ESM .js (they were .ts until 5c76b2f renamed them; this alias
// was left pointing at the old .ts path, which no longer exists).
const sharedSource = fileURLToPath(new URL('../packages/shared/src/index.js', import.meta.url));

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
        target: process.env.VITE_BACKEND_PROXY_TARGET || process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    globals: true,
  },
});
