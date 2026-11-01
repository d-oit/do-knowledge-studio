import { describe, expect, it } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { conceptRankIds, hybridRankIds, lexicalRankIds } from './strategies'
import {
  EVAL_K,
  evaluateStrategy,
  recallAtK,
  reciprocalRank,
  type LabelledQuery,
  type StrategyMetrics,
} from './metrics'

/**
 * Hybrid-search evaluation harness (Issue #1065).
 *
 * Three strategies rank the same fixture corpus and are scored by the same
 * metrics: BM25 (`search`), the deterministic concept ranker that stands in
 * for the embedding model, and rank fusion of the two.
 *
 * The fixture is built so each single mode has a query it cannot answer:
 *
 * - "employee onboarding" is a paraphrase — the relevant document says
 *   "new hire induction", sharing no content tokens with the query, so BM25
 *   finds nothing and only the concept ranker can reach it.
 * - "TRIZ-42" is an identifier — the document carries that literal token, but
 *   the concept space has no term for it, so only BM25 reaches it.
 *
 * Hybrid recall therefore has to exceed both single modes on this set. That is
 * the acceptance criterion the issue asks for, expressed as a deterministic
 * assertion rather than a timing baseline, so it can run in the regular suite.
 */

const makeEntity = (overrides: Partial<Entity> & Pick<Entity, 'id' | 'name'>): Entity => ({
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const CORPUS: readonly Entity[] = [
  makeEntity({
    id: 'e-onboarding',
    name: 'New hire induction procedure',
    description: 'Checklist and first-week schedule for a newcomer',
    tags: ['people'],
  }),
  makeEntity({
    id: 'e-triz-42',
    name: 'TRIZ-42 separation principle',
    description: 'Splitting conflicting requirements across time',
    tags: ['innovation'],
  }),
  makeEntity({
    id: 'e-search',
    name: 'Ranking pipeline',
    description: 'Relevance scoring for local retrieval',
    tags: ['search'],
  }),
  makeEntity({
    id: 'e-export',
    name: 'Archive download',
    description: 'Portable backup of the whole corpus',
    tags: ['export'],
  }),
  makeEntity({
    id: 'e-sync',
    name: 'Peer collaboration',
    description: 'WebRTC transport for multi-device sync',
    tags: ['sync'],
  }),
]

const QUERIES: readonly LabelledQuery[] = [
  // Paraphrase: no shared content token with the document it should find.
  { query: 'employee onboarding', relevantIds: ['e-onboarding'] },
  // Identifier: literal token, outside the concept space.
  { query: 'TRIZ-42', relevantIds: ['e-triz-42'] },
  // Both engines can answer this one.
  { query: 'retrieval ranking', relevantIds: ['e-search'] },
  { query: 'backup export', relevantIds: ['e-export'] },
  { query: 'webrtc peer sync', relevantIds: ['e-sync'] },
]

const lexicalRank = (query: string): readonly string[] =>
  lexicalRankIds(CORPUS, [], query, EVAL_K)

const semanticRank = (query: string): readonly string[] =>
  conceptRankIds(CORPUS, query, EVAL_K)

const hybridRank = (query: string): readonly string[] =>
  hybridRankIds(CORPUS, [], query, EVAL_K)

const format = (metrics: StrategyMetrics): string =>
  `recall@${String(EVAL_K)}=${metrics.recallAtK.toFixed(3)} mrr=${metrics.mrr.toFixed(3)}`

describe('retrieval metrics', () => {
  it('counts only relevant ids inside the cut', () => {
    expect(recallAtK(['a', 'b', 'c'], ['a', 'c'], 2)).toBe(0.5)
    expect(recallAtK(['a', 'b', 'c'], ['a', 'c'], 3)).toBe(1)
    expect(recallAtK(['x'], ['a'], 3)).toBe(0)
  })

  it('scores an unlabelled query as zero rather than perfect', () => {
    expect(recallAtK(['a'], [], 3)).toBe(0)
    expect(reciprocalRank(['a'], [])).toBe(0)
    expect(recallAtK(['a'], ['a'], 0)).toBe(0)
  })

  it('rewards earlier ranks with a larger reciprocal rank', () => {
    expect(reciprocalRank(['a', 'b'], ['a'])).toBe(1)
    expect(reciprocalRank(['a', 'b'], ['b'])).toBe(0.5)
    expect(reciprocalRank(['a', 'b'], ['z'])).toBe(0)
  })

  it('averages per query instead of pooling hits', () => {
    // Query A is fully answered (1.0), query B is missed (0.0).
    const metrics = evaluateStrategy(
      [
        { query: 'a', relevantIds: ['a'] },
        { query: 'b', relevantIds: ['b'] },
      ],
      (query) => (query === 'a' ? ['a'] : ['z']),
      3,
    )
    expect(metrics.recallAtK).toBe(0.5)
    expect(metrics.mrr).toBe(0.5)
  })

  it('returns zeroed metrics for an empty query set', () => {
    expect(evaluateStrategy([], () => [], 3)).toEqual({ recallAtK: 0, mrr: 0 })
  })
})

describe('hybrid search evaluation harness', () => {
  const lexical = evaluateStrategy(QUERIES, lexicalRank)
  const semantic = evaluateStrategy(QUERIES, semanticRank)
  const hybrid = evaluateStrategy(QUERIES, hybridRank)

  it('measures lexical, semantic and fused ranking with the same metrics', () => {
    process.stdout.write(
      `\nhybrid eval (${String(QUERIES.length)} labelled queries)\n` +
        `  lexical  ${format(lexical)}\n` +
        `  semantic ${format(semantic)}\n` +
        `  hybrid   ${format(hybrid)}\n`,
    )
    expect(lexical.recallAtK).toBeGreaterThanOrEqual(0)
    expect(semantic.recallAtK).toBeGreaterThanOrEqual(0)
    expect(hybrid.recallAtK).toBeGreaterThanOrEqual(0)
  })

  it('gives each single mode a query the other cannot answer', () => {
    // The paraphrase defeats BM25 and is reachable only by concept overlap.
    expect(lexicalRank('employee onboarding')).toEqual([])
    expect(semanticRank('employee onboarding')).toContain('e-onboarding')

    // The identifier defeats the concept ranker and is reachable only by BM25.
    expect(lexicalRank('TRIZ-42')).toContain('e-triz-42')
    expect(semanticRank('TRIZ-42')).not.toContain('e-triz-42')
  })

  it('beats or matches the better single mode on recall and MRR', () => {
    expect(hybrid.recallAtK).toBeGreaterThanOrEqual(
      Math.max(lexical.recallAtK, semantic.recallAtK),
    )
    expect(hybrid.mrr).toBeGreaterThanOrEqual(Math.max(lexical.mrr, semantic.mrr))
  })

  it('is strictly better than lexical-only coverage on this fixture', () => {
    // Fusion is why the paraphrase query is answered at all; without it the
    // hybrid strategy would score exactly like BM25.
    expect(hybrid.recallAtK).toBeGreaterThan(lexical.recallAtK)
    expect(hybrid.mrr).toBeGreaterThan(lexical.mrr)
  })

  it('caps results at the label cut so extra candidates cannot inflate recall', () => {
    const allIds = CORPUS.map((entity) => entity.id)
    expect(recallAtK(allIds, ['e-onboarding'], 1)).toBeLessThanOrEqual(1)
    expect(evaluateStrategy(QUERIES, () => allIds, 1).recallAtK).toBeLessThan(
      evaluateStrategy(QUERIES, () => allIds, EVAL_K).recallAtK,
    )
  })
})
