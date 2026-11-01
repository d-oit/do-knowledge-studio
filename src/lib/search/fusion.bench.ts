/**
 * Reciprocal rank fusion benchmark.
 *
 * This is a `*.bench.ts` file on purpose: Vitest's bench mode collects
 * `*.bench.ts` / `*.benchmark.ts` by default, while the repository's existing
 * `*.bench.test.ts` files hold threshold *guards* that run under `vitest run`.
 * Keeping the measurement here means `pnpm run bench:measure` executes real
 * `bench()` blocks instead of silently matching nothing.
 *
 * Run with `pnpm run bench:measure`.
 */

import { bench, describe } from 'vitest'
import { reciprocalRankFusion } from './fusion'
import type { SearchResult } from './retrieval'

/** Ranks per list — a full result page from each retriever. */
const RANKING_SIZE = 100
/** Deliberately larger than the page: fusion must also sort the tail. */
const FUSED_LIMIT = 50

const makeRanking = (prefix: string, size: number): SearchResult[] =>
  Array.from({ length: size }, (_, index) => ({
    id: `${prefix}-${String(index)}`,
    type: 'entity' as const,
    name: `${prefix} ${String(index)}`,
    snippet: `${prefix} snippet ${String(index)}`,
    score: 0,
  }))

const lexical = makeRanking('lexical', RANKING_SIZE)
const semantic = makeRanking('semantic', RANKING_SIZE)

/** Half the lists overlap, which is the realistic case for one corpus. */
const overlappingSemantic: SearchResult[] = [
  ...semantic.slice(0, RANKING_SIZE / 2),
  ...lexical.slice(0, RANKING_SIZE / 2).map((result) => ({
    ...result,
    name: `semantic ${result.name}`,
  })),
]

describe('reciprocal rank fusion', () => {
  bench('fuse two disjoint 100-item rankings', () => {
    reciprocalRankFusion(
      [
        { signal: 'semantic', results: semantic },
        { signal: 'lexical', results: lexical },
      ],
      FUSED_LIMIT,
    )
  })

  bench('fuse two half-overlapping 100-item rankings', () => {
    reciprocalRankFusion(
      [
        { signal: 'semantic', results: overlappingSemantic },
        { signal: 'lexical', results: lexical },
      ],
      FUSED_LIMIT,
    )
  })
})
