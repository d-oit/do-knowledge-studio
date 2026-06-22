import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
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
        // Exclude CLI command dispatchers — they require a live SQLite database
        // and are integration-tested via the CLI binary. Their registration is
        // already covered by cli/__tests__/commands.test.ts.
        'cli/commands/**',
        // Exclude React-PDF document components — they render to a custom PDF
        // layout engine that is not exercisable in happy-dom. The export logic
        // is covered by src/features/export/__tests__/pdf-exporter.test.tsx and
        // the browser download path is covered manually.
        'src/features/export/pdf-documents.tsx',
        'src/features/export/pdf-styles.ts',
      ],
      thresholds: {
        branches: 33,
        functions: 37,
        lines: 42,
        statements: 41,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
