import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    // Limit workers to prevent OOM in restricted CI environments
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/*.config.*',
        '**/__tests__/**',
        // Exclude low-level WASM/Worker glue code that is difficult to unit test in JSDOM
        'src/db/client.ts',
        'src/db/db-worker.ts',
      ],
      // Thresholds are set to reflect the broad inclusion of UI/feature modules
      // while maintaining a baseline for future growth.
      thresholds: {
        branches: 14,
        functions: 16,
        lines: 25,
        statements: 24,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
