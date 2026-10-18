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
      '**/*.bench.test.ts',
    ],
    // Restore spy implementations and global stubs between tests by default.
    restoreMocks: true,
    unstubGlobals: true,
    pool: 'threads',
    maxWorkers: '50%',
    // Test-source types are checked separately by `pnpm run typecheck:test`;
    // Vitest's experimental typecheck feature duplicates that gate and emits a warning.
    coverage: {
      provider: 'v8',
      // `json-summary` writes coverage/coverage-summary.json, which the
      // "Generate coverage badge" step in .github/workflows/ci-and-labels.yml
      // reads on every push to main.
      reporter: ['text', 'json', 'json-summary', 'html'],
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
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
