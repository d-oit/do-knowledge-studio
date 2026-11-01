// @vitest-environment node
//
// Node environment, not jsdom. onnxruntime validates tensors with a
// cross-realm `instanceof Float32Array` against Node's native constructor, so
// under jsdom every tensor fails with "A float32 tensor's data must be type of
// function Float32Array()". The app runs in a browser; this harness runs the
// same weights on the Node backend, where jsdom's realm is the problem.

import { describe, expect, it } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { seedClaims, seedEntities } from '@/lib/studio/seed-data'
import { embedTexts, setEmbeddingDeviceForTests } from '@/lib/search/embeddings'
import { VectorStore } from '@/lib/search/vector-index'
import { EVAL_K, evaluateStrategy, type StrategyMetrics } from './metrics'
import { SEED_QUERIES } from './seed-queries'
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
 * The scores are not comparable to `seed-corpus.test.ts` as a quality contest:
 * both use the same labels, but one ranks with an embedding model and the other
 * with a hand-written concept table. The point is that the same metrics, the
 * same labels and the same fusion step now have a model-backed arm.
 */

const MODEL_EVAL_ENABLED = process.env.RUN_MODEL_EVAL === '1'

/** Model inference plus a cold download needs far more than the default. */
const MODEL_EVAL_TIMEOUT_MS = 300_000

/**
 * How far fusion's MRR may trail the pure-semantic arm before it counts as a
 * fusion defect. Measured headroom is ~0.005; the bound is set an order of
 * magnitude above that so it catches a broken fusion step, not rounding.
 */
const FUSION_MRR_TOLERANCE = 0.05

/** Document text mirrors what `vector-store.ts` embeds for an entity. */
const documentText = (entity: Entity): string =>
  `${entity.name} ${entity.description} ${entity.content} ${entity.tags.join(' ')}`

const format = (label: string, metrics: StrategyMetrics): string =>
  `  ${label.padEnd(12)} recall@${String(EVAL_K)}=${metrics.recallAtK.toFixed(3)} ` +
  `mrr=${metrics.mrr.toFixed(3)}`

describe.skipIf(!MODEL_EVAL_ENABLED)('model-backed seed-corpus evaluation', () => {
  it(
    'scores lexical, embedding and fused retrieval with the real model',
    async () => {
      // The app pins `wasm`, which Node rejects. `cpu` is the same quantized
      // weights on the onnxruntime-node backend, so the vectors are comparable.
      setEmbeddingDeviceForTests('cpu')

      const docTexts = seedEntities.map(documentText)
      const docVectors = await embedTexts(docTexts)
      // One batch for every query: the model is loaded once and reused.
      const queryVectors = await embedTexts(SEED_QUERIES.map((entry) => entry.query))

      const store = new VectorStore()
      seedEntities.forEach((entity, index) => {
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

      const vectorForQuery = (query: string): number[] => {
        const index = SEED_QUERIES.findIndex((entry) => entry.query === query)
        const vector = queryVectors[index]
        if (vector === undefined) throw new Error(`no query vector for "${query}"`)
        return vector
      }

      const semantic = (query: string): readonly string[] =>
        store.search(vectorForQuery(query), EVAL_K).map((hit) => hit.id)

      const lexical = (query: string): readonly string[] =>
        lexicalRankIds(seedEntities, seedClaims, query, EVAL_K)

      const hybrid = (query: string): readonly string[] =>
        fuseWithSemanticIds(
          seedEntities,
          seedClaims,
          query,
          semantic(query),
          EVAL_K,
        )

      const lexicalMetrics = evaluateStrategy(SEED_QUERIES, lexical)
      const semanticMetrics = evaluateStrategy(SEED_QUERIES, semantic)
      const hybridMetrics = evaluateStrategy(SEED_QUERIES, hybrid)

      process.stdout.write(
        `\nmodel-backed eval (${String(SEED_QUERIES.length)} labels, ` +
          `${String(seedEntities.length)} entities, real embeddings)\n` +
          `${format('lexical', lexicalMetrics)}\n` +
          `${format('embedding', semanticMetrics)}\n` +
          `${format('hybrid', hybridMetrics)}\n`,
      )

      // Every label must be reachable by the model-backed path, otherwise the
      // numbers describe a broken corpus rather than a ranking.
      for (const entry of SEED_QUERIES) {
        expect(
          hybrid(entry.query).some((id) => entry.relevantIds.includes(id)),
          `hybrid found nothing for "${entry.query}"`,
        ).toBe(true)
      }

      // The claim under test: fusing embeddings with BM25 does not lose what
      // either retriever found. Reported, not asserted as an absolute score —
      // eight authored labels cannot support a quality threshold.
      expect(hybridMetrics.recallAtK).toBeGreaterThanOrEqual(
        Math.max(lexicalMetrics.recallAtK, semanticMetrics.recallAtK),
      )
      // MRR is deliberately NOT asserted against the better arm. Measured on
      // this set, fusion scores 0.859 against pure-embedding 0.865: reciprocal
      // rank fusion promotes a hit the weak lexical list also found, which
      // costs a fraction of a rank. That is fusion's documented cost, not a
      // regression, so asserting the max would encode a claim the data
      // refutes. The guards that can actually fail: fusion must not trail the
      // weak arm it is built from, and must stay inside
      // FUSION_MRR_TOLERANCE of the strong one — a fusion step that discards
      // the semantic ranking lands far outside it.
      expect(hybridMetrics.mrr).toBeGreaterThanOrEqual(lexicalMetrics.mrr)
      expect(hybridMetrics.mrr).toBeGreaterThanOrEqual(
        semanticMetrics.mrr - FUSION_MRR_TOLERANCE,
      )
    },
    MODEL_EVAL_TIMEOUT_MS,
  )
})
