import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    passWithNoTests: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
    ],
    // Wave 3 work-in-progress tests are marked with test.skip inside
    // their files rather than silently excluded here, so they surface
    // in reports. Files:
    //   cli/__tests__/import-command.test.ts
    //   src/features/ai/__tests__/useChat.rateLimit.test.ts
    //   src/features/ai/__tests__/useRateLimiter.test.ts
    //   src/features/search/__tests__/SearchPanel.createEntity.test.tsx
    //   src/lib/search/__tests__/progressive.test.ts

    // threads with capped workers avoids OOM while still running
    // tests in parallel (vs the previous singleFork serial mode).
    pool: 'threads',
    maxWorkers: 2,

    // Type-check test files using the dedicated tsconfig.
    typecheck: {
      tsconfig: './tsconfig.test.json',
      enabled: true,
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
        // WASM/Worker glue — not exercisable in JSDOM.
        'src/db/client.ts',
        'src/db/db-worker.ts',
        // CLI command dispatchers — integration-tested via CLI binary.
        'cli/commands/**',
        // React-PDF document components — PDF engine not exercisable in happy-dom.
        'src/features/export/pdf-documents.tsx',
        'src/features/export/pdf-styles.ts',
      ],
      // Thresholds from Wave 2 baseline (branches:36, functions:40,
      // lines:45, statements:44). Set to current actual coverage levels
      // (~43/48/55/53). Increase by ~5 pts per release toward a long-term
      // target of branches:70, functions:75, lines:80.
      thresholds: {
        branches: 46,
        functions: 52,
        lines: 57,
        statements: 55,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
