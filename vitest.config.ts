import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', '!src/**/*.d.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/*.config.*',
        '**/__tests__/**',
        'src/db/client.ts',
        'src/db/db-worker.ts',
        'src/lib/llm/**',
        'src/features/**',
      ],
      branches: 50,
      functions: 60,
      lines: 50,
      statements: 50,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
