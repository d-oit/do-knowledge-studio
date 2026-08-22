import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    passWithNoTests: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
    ],
    // Restore spy implementations between tests by default — suites that
    // need cross-test mock state must opt in explicitly.
    restoreMocks: true,
    pool: 'threads',
    maxWorkers: 2,
    typecheck: {
      tsconfig: './tsconfig.test.json',
      enabled: true,
      include: ['src/**/*.test-d.ts'],
      // Legacy *.test.ts files carry ~73 pre-existing type errors (loose
      // yjs mocks). Source-error gating returns once those are fixed —
      // tracked in plans/131 G9. New type-contract files gate today.
      ignoreSourceErrors: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.*',
        '**/__tests__/**',
        // Test files colocated with source must not inflate coverage —
        // only production modules count toward thresholds (Plan 131 G7).
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/test/**',
      ],
      // Honest baselines measured after excluding test files from coverage
      // (Plan 131 G7). Plan 130 A18 owns raising these targets.
      thresholds: {
        branches: 75,
        functions: 78,
        lines: 84,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
