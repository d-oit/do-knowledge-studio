// @vitest-environment node
//
// Node environment, not jsdom. onnxruntime validates tensors with a
// cross-realm `instanceof Float32Array` against Node's native constructor, so
// under jsdom every tensor fails with "A float32 tensor's data must be type of
// function Float32Array()". The app runs in a browser; this harness runs the
// same weights on the Node backend, where jsdom's realm is the problem.

import { describe, expect, it } from 'vitest'
import type { Claim, Entity } from '@/lib/studio/types'
import { seedClaims, seedEntities } from '@/lib/studio/seed-data'
import { embedTexts, setEmbeddingDeviceForTests } from '@/lib/search/embeddings'
import { VectorStore } from '@/lib/search/vector-index'
import {
  EVAL_K,
  evaluateStrategy,
  type LabelledQuery,
  type StrategyMetrics,
} from './metrics'
import { SEED_QUERIES } from './seed-queries'
import { LARGE_CORPUS, LARGE_QUERIES } from './large-corpus'
import { fuseWithSemanticIds, lexicalRankIds } from './strategies'

/**
 * Model-backed retrieval evaluation (Issue #1065).
 *
 * This is the harness that answers the question the concept stand-in could not:
 * does the *real* embedding model (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`,
 * the one the app ships) actually improve retrieval on real prose?
 *
 * Opt-in on purpose. It downloads a ~25 MB ONNX model on first run, which must
 * not happen inside CI on every push, so it runs only with `RUN_MODEL_EVAL=1`:
 *
 *   RUN_MODEL_EVAL=1 pnpm exec vitest run src/lib/search/eval/model-eval.test.ts
 *
 * That also means it is **not a gate**. A skipped test proves nothing, and this
 * file must never be cited as CI evidence — it is a measurement you run when
 * changing the retrieval stack, and the numbers it prints belong in `plans/`.
 *
 * Two corpora are scored by the same code: the shipped seed library (8 docs,
 * real prose) and `large-corpus.ts` (24 docs, more distractors per query). Both
 * rank through `fuseWithSemanticIds`, so a difference between them cannot come
 * from the fusion step.
 */

const MODEL_EVAL_ENABLED = process.env.RUN_MODEL_EVAL === '1'

/** Model inference plus a cold download needs far more than the default. */
const MODEL_EVAL_TIMEOUT_MS = 300_000

/**
 * How far fusion's MRR may trail the pure-semantic arm before it counts as a
 * fusion defect. Measured headroom is ~0.005 on the seed corpus; the bound is
 * an order of magnitude above that so it catches a broken fusion step rather
 * than rounding.
 */
const FUSION_MRR_TOLERANCE = 0.05

/** Document text mirrors what `vector-store.ts` embeds for an entity. */
const documentText = (entity: Entity): string =>
  `${entity.name} ${entity.description} ${entity.content} ${entity.tags.join(' ')}`

/** Metrics for the three modes over one corpus. */
interface CorpusScore {
  lexical: StrategyMetrics
  embedding: StrategyMetrics
  hybrid: StrategyMetrics
}

const format = (label: string, metrics: StrategyMetrics): string =>
  `  ${label.padEnd(10)} recall@${String(EVAL_K)}=${metrics.recallAtK.toFixed(3)} ` +
  `mrr=${metrics.mrr.toFixed(3)}`

/**
 * Scores lexical, embedding and fused retrieval over one corpus.
 *
 * Shared by both `it` blocks so the two corpora cannot diverge in how they are
 * measured — the only input that changes is the documents and the labels.
 */
const scoreCorpus = async (
  entities: readonly Entity[],
  claims: readonly Claim[],
  queries: readonly LabelledQuery[],
): Promise<CorpusScore> => {
  const docTexts = entities.map(documentText)
  const docVectors = await embedTexts(docTexts)
  // One batch for every query: the model is loaded once and reused.
  const queryVectors = await embedTexts(queries.map((entry) => entry.query))

  const store = new VectorStore()
  entities.forEach((entity, index) => {
    store.add(
      {
        id: entity.id,
        type: 'entity',
        name: entity.name,
        fullText: docTexts[index] ?? '',
        entityType: entity.type,
      },
      docVectors[index] ?? [],
    )
  })

  const vectorFor = (query: string): number[] => {
    const index = queries.findIndex((entry) => entry.query === query)
    const vector = queryVectors[index]
    if (vector === undefined) throw new Error(`no query vector for "${query}"`)
    return vector
  }

  const embedding = (query: string): readonly string[] =>
    store.search(vectorFor(query), EVAL_K).map((hit) => hit.id)
  const lexical = (query: string): readonly string[] =>
    lexicalRankIds(entities, claims, query, EVAL_K)
  const hybrid = (query: string): readonly string[] =>
    fuseWithSemanticIds(entities, claims, query, embedding(query), EVAL_K)

  return {
    lexical: evaluateStrategy(queries, lexical),
    embedding: evaluateStrategy(queries, embedding),
    hybrid: evaluateStrategy(queries, hybrid),
  }
}

/**
 * The properties fusion must satisfy, whichever corpus it runs on.
 *
 * Recall keeps the "at least as good as the better single mode" claim, which
 * fusion's union guarantees. MRR deliberately does not assert against the
 * better arm: measured on the seed corpus, fusion scores 0.859 against pure
 * embedding's 0.865, because reciprocal rank fusion promotes a hit the weaker
 * lexical list also matched. That is fusion's cost, not a regression, so
 * asserting the max would encode a claim the data refutes. Instead: fusion must
 * not trail the weak arm it is built from, and must stay inside
 * FUSION_MRR_TOLERANCE of the strong one — a fusion step that discards the
 * semantic ranking lands far outside that.
 */
const expectFusionHolds = (label: string, score: CorpusScore): void => {
  expect(score.hybrid.recallAtK, `${label}: fusion lost recall`).toBeGreaterThanOrEqual(
    Math.max(score.lexical.recallAtK, score.embedding.recallAtK),
  )
  expect(score.hybrid.mrr, `${label}: fusion trails the lexical arm`).toBeGreaterThanOrEqual(
    score.lexical.mrr,
  )
  expect(score.hybrid.mrr, `${label}: fusion trails pure embeddings`).toBeGreaterThanOrEqual(
    score.embedding.mrr - FUSION_MRR_TOLERANCE,
  )
}

describe.skipIf(!MODEL_EVAL_ENABLED)('model-backed retrieval evaluation', () => {
  it(
    'scores the shipped seed corpus with real embeddings',
    async () => {
      // The app pins `wasm`, which Node rejects. `cpu` is the same quantized
      // weights on the onnxruntime-node backend, so the vectors are comparable.
      setEmbeddingDeviceForTests('cpu')

      const score = await scoreCorpus(seedEntities, seedClaims, SEED_QUERIES)
      process.stdout.write(
        `\nmodel-backed eval — seed corpus (${String(SEED_QUERIES.length)} labels, ` +
          `${String(seedEntities.length)} documents)\n` +
          `${format('lexical', score.lexical)}\n` +
          `${format('embedding', score.embedding)}\n` +
          `${format('hybrid', score.hybrid)}\n`,
      )

      // Every label must be reachable by the fused path, otherwise the numbers
      // describe a broken corpus rather than a ranking.
      for (const entry of SEED_QUERIES) {
        expect(
          entry.relevantIds.length,
          `label "${entry.query}" has no relevant ids`,
        ).toBeGreaterThan(0)
      }
      expectFusionHolds('seed corpus', score)
    },
    MODEL_EVAL_TIMEOUT_MS,
  )

  it(
    'scores the larger fixture corpus with real embeddings',
    async () => {
      // Same run, same loaded pipeline; a second call is inference only.
      setEmbeddingDeviceForTests('cpu')

      const score = await scoreCorpus(LARGE_CORPUS, [], LARGE_QUERIES)
      process.stdout.write(
        `\nmodel-backed eval — large corpus (${String(LARGE_QUERIES.length)} labels, ` +
          `${String(LARGE_CORPUS.length)} documents)\n` +
          `${format('lexical', score.lexical)}\n` +
          `${format('embedding', score.embedding)}\n` +
          `${format('hybrid', score.hybrid)}\n`,
      )

      // The value of this corpus is that it is not saturated: if BM25 already
      // answered every label, the comparison would measure nothing. Assert the
      // gap exists rather than asserting a particular size for it.
      expect(score.lexical.recallAtK).toBeLessThan(1)
      expect(score.embedding.recallAtK).toBeGreaterThan(score.lexical.recallAtK)
      expectFusionHolds('large corpus', score)
    },
    MODEL_EVAL_TIMEOUT_MS,
  )
})
