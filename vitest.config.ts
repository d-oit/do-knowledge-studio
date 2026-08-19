import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // No tests are implemented yet. Allow an empty run so `pnpm test` and the
    // quality gate stay green until the G2 wave adds real coverage.
    passWithNoTests: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.next/**',
      'coverage/**',
      'out/**',
    ],
    // Threads with capped workers avoids OOM while still running tests in
    // parallel.
    pool: 'threads',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
