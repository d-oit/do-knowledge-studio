import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/nlp.bench.test.ts',
      'src/lib/search/retrieval.bench.test.ts',
      'src/lib/ai/context.bench.test.ts',
      'src/lib/studio/claim-parser.bench.test.ts',
      'src/lib/studio/triz-data.bench.test.ts',
      'src/lib/studio/graph-layout.bench.test.ts',
      'src/lib/studio/canonical-storage.bench.test.ts',
      'src/lib/studio/revisions.bench.test.ts',
      'src/lib/search/vector-store.bench.test.ts',
    ],
    // `bench()` blocks live in `*.bench.ts` (Vitest's bench include pattern);
    // the `*.bench.test.ts` entries above are threshold guards for `vitest run`.
    benchmark: {
      include: ['src/lib/search/fusion.bench.ts'],
    },
    pool: 'threads',
    maxWorkers: '50%',
    restoreMocks: true,
    unstubGlobals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
