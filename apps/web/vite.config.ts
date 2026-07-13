/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // PORT override lets tooling assign a free port; 5173 remains the default.
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    // The suite is 200+ jsdom tests; under full-suite worker contention,
    // userEvent-heavy specs intermittently blow the 5s default.
    testTimeout: 15_000,
  },
});
