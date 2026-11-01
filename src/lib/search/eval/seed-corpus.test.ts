import { describe, expect, it } from 'vitest'
import { seedClaims, seedEntities } from '@/lib/studio/seed-data'
import { EVAL_K, evaluateStrategy } from './metrics'
import { SEED_QUERIES as QUERIES } from './seed-queries'
import { conceptRankIds, hybridRankIds, lexicalRankIds } from './strategies'

/**
 * Real-corpus retrieval evaluation (Issue #1065).
 *
 * `harness.test.ts` scores a synthetic fixture whose only job is to be
 * unambiguous. This runs the identical metrics and the identical strategy code
 * over the library the app actually ships as its seed corpus, so the numbers
 * are about real prose with real tag noise, not a hand-built control set.
 *
 * The labels are authored, which is the honest limit of this file: it is a
 * small human-judged set over real text, not a ground-truth benchmark. It can
 * catch a regression in fusion, ranking or tokenisation; it cannot claim
 * absolute retrieval quality. `#1065` tracks a larger labelled set.
 *
 * Recall is asserted as an inequality between strategies rather than as an
 * absolute value, because a threshold on eight authored queries would be a
 * number with no meaning behind it.
 */

const lexical = (query: string): readonly string[] =>
  lexicalRankIds(seedEntities, seedClaims, query, EVAL_K)
const concept = (query: string): readonly string[] =>
  conceptRankIds(seedEntities, query, EVAL_K)
const hybrid = (query: string): readonly string[] =>
  hybridRankIds(seedEntities, seedClaims, query, EVAL_K)

const format = (label: string, metrics: { recallAtK: number; mrr: number }): string =>
  `  ${label.padEnd(9)} recall@${String(EVAL_K)}=${metrics.recallAtK.toFixed(3)} mrr=${metrics.mrr.toFixed(3)}`

describe('seed-corpus retrieval evaluation', () => {
  const lexicalMetrics = evaluateStrategy(QUERIES, lexical)
  const conceptMetrics = evaluateStrategy(QUERIES, concept)
  const hybridMetrics = evaluateStrategy(QUERIES, hybrid)

  it('scores all three strategies over the shipped corpus', () => {
    process.stdout.write(
      `\nseed-corpus eval (${String(QUERIES.length)} labelled queries, ` +
        `${String(seedEntities.length)} entities)\n` +
        `${format('lexical', lexicalMetrics)}\n` +
        `${format('semantic', conceptMetrics)}\n` +
        `${format('hybrid', hybridMetrics)}\n`,
    )
    expect(seedEntities.length).toBeGreaterThan(0)
    expect(hybridMetrics.recallAtK).toBeGreaterThan(0)
  })

  it('does not lose recall when fusing on real prose', () => {
    // The fixture proves fusion *adds* coverage; this proves it does not
    // subtract it on the corpus shipping with the app, where rankings are
    // noisier than the control set.
    expect(hybridMetrics.recallAtK).toBeGreaterThanOrEqual(
      Math.max(lexicalMetrics.recallAtK, conceptMetrics.recallAtK),
    )
  })

  it('matches or beats lexical MRR on the shipped corpus', () => {
    expect(hybridMetrics.mrr).toBeGreaterThanOrEqual(lexicalMetrics.mrr)
  })

  it('points every label at a document that still exists', () => {
    // This replaced a "the concept arm reaches every label" check, which held
    // only while the labels were tuned to that arm's vocabulary. The paraphrase
    // block is deliberately outside it, so a miss there is the expected case,
    // not a defect. What must hold for any label set is that it names documents
    // the corpus still contains — a deleted document or a typo'd id would let
    // recall look healthy while measuring nothing. "A retriever reaches it" is
    // asserted in model-eval.test.ts, where the retriever under test can.
    const known = new Set(seedEntities.map((entity) => entity.id))
    for (const entry of QUERIES) {
      for (const id of entry.relevantIds) {
        expect(known.has(id), `unknown id ${id} for "${entry.query}"`).toBe(true)
      }
    }
  })

  it('does not regress fusion on real prose', () => {
    // Measured on this corpus: BM25 answers every labelled query at k=5, so the
    // useful guard is that fusion keeps that — a fusion step that discards the
    // lexical ranking drops hybrid to the concept score while lexical stays at
    // 1.000, and this fails.
    //
    // The concept stand-in scores 0.000 here (printed above): its vocabulary is
    // tuned to the synthetic fixture and does not generalise. That is the
    // harness's own limit, recorded in plan 191 — real-corpus semantic numbers
    // need the actual embedding model, not this table.
    expect(hybridMetrics.recallAtK).toBe(lexicalMetrics.recallAtK)
  })
})
