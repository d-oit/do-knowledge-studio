/**
 * Reciprocal rank fusion (RRF) for combining independently ranked retrieval
 * lists into one ranking.
 *
 * Fusion uses ranks, not scores: BM25 scores and cosine similarities live on
 * incomparable scales, so adding them would let whichever engine happens to
 * emit larger numbers dominate. RRF instead sums `1 / (k + rank)` across the
 * lists, which rewards documents that rank well in either engine and rewards
 * agreement between them.
 */

import type { SearchResult } from './retrieval'

/**
 * Damping constant from the original RRF paper (Cormack et al.). 60 keeps one
 * strong first-place hit from outweighing a document that both engines rank.
 */
export const RRF_DAMPING = 60

/** Which retriever ranked a document, surfaced per hit so the UI can label it. */
export type RankSignal = 'lexical' | 'semantic'

/** Weight applied to a list that does not specify one. */
export const DEFAULT_RANK_WEIGHT = 1

/**
 * Weight the app gives BM25 inside fusion. Deliberately 1 (plain RRF).
 *
 * Measured, not assumed (`RUN_MODEL_EVAL=1`, weight sweep; recall stayed 1.000
 * throughout):
 *
 * | lexical weight | seed corpus MRR | large corpus MRR |
 * | --- | ---: | ---: |
 * | 1.00 (plain RRF, shipped) | 0.859 | 0.938 |
 * | 0.75 | 0.865 | 0.938 |
 * | 0.50 | 0.865 | 0.938 |
 * | 0.25 | 0.896 | 0.938 |
 *
 * Discounting lexical does close the seed-corpus gap against pure embeddings
 * (0.865). It was still declined, because the gain is 0.006 MRR on eight
 * authored documents and the cost is a guarantee: with lexical at 0.5, a
 * document only BM25 found drops below semantic-only hits, and out of a tight
 * result cut. `vector-store.test.ts` caught exactly that — its lexical-only hit
 * fell from second to third place — and that is the identifier-query shape
 * ("TRIZ-42"), where BM25 is the only engine with anything to say.
 *
 * Trading a visible behaviour for a rounding error is the wrong way round. The
 * parameter stays so this can be revisited with identifier labels in the
 * harness and a wider cut than two results; until then, 1 is the answer.
 */
export const FUSION_LEXICAL_WEIGHT = 1

/** One retriever's ranking, labelled with the signal it represents. */
export interface RankedList {
  signal: RankSignal
  results: readonly SearchResult[]
  /**
   * Relative influence of this list (`DEFAULT_RANK_WEIGHT` when omitted).
   *
   * RRF assumes the lists are equally trustworthy. They are not always: BM25 on
   * a corpus of paraphrases answers few queries but ranks them confidently, so
   * its agreement can drag a correct semantic hit down a place. Weighting
   * below 1 discounts that agreement without discarding the list, which is the
   * difference between "lexical evidence matters less" and "ignore lexical".
   *
   * The same weight is multiplied into every rank contribution from the list,
   * so it cannot change the ordering *within* one list — only how much that
   * list's ordering moves the fused result.
   */
  weight?: number
}

/** A fused hit plus the retrievers that ranked it. */
export interface FusedSearchResult extends SearchResult {
  /** Signals that contributed, in the order the lists were supplied. */
  signals: RankSignal[]
}

/**
 * Precomputed table of rank contributions for standard ranked list depths.
 * Pre-allocating 256 ranks covers virtually all practical retrieval limits
 * while eliminating repeated floating-point divisions in the inner loop.
 */
const PRECOMPUTED_RANK_LIMIT = 256
const RANK_CONTRIBUTIONS = new Float64Array(PRECOMPUTED_RANK_LIMIT)
for (let rank = 0; rank < PRECOMPUTED_RANK_LIMIT; rank++) {
  RANK_CONTRIBUTIONS[rank] = 1 / (RRF_DAMPING + rank + 1)
}

/** One entry's contribution to the fused score at a zero-based rank. */
const rankContribution = (rank: number): number =>
  rank < PRECOMPUTED_RANK_LIMIT ? RANK_CONTRIBUTIONS[rank]! : 1 / (RRF_DAMPING + rank + 1)

/**
 * Merges labelled ranked lists into a single ranking.
 *
 * Documents are deduplicated by id; the payload (name, snippet, entity
 * context) comes from the list that ranked the document highest, and the
 * returned `score` is the fused RRF score. Each hit also records which
 * retrievers ranked it, so a caller can say whether a result was matched by
 * keywords, by meaning, or by both — the distinction is text, not colour.
 * Ties break by id so the ordering is deterministic across runs.
 *
 * @param rankedLists - Result lists in priority order; earlier lists win ties
 *   in the fused ranking and lead each hit's `signals`.
 * @param limit - Maximum number of results to return.
 */
export const reciprocalRankFusion = (
  rankedLists: readonly RankedList[],
  limit: number,
): FusedSearchResult[] => {
  if (limit <= 0) return []

  const fused = new Map<
    string,
    { result: SearchResult; score: number; signals: RankSignal[] }
  >()

  for (let i = 0; i < rankedLists.length; i++) {
    const list = rankedLists[i]!
    const weight = list.weight ?? DEFAULT_RANK_WEIGHT
    const results = list.results
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank]!
      const contribution = rankContribution(rank) * weight
      const existing = fused.get(result.id)
      if (existing === undefined) {
        // Store result reference directly; clone only the final top-K items to avoid GC thrashing.
        fused.set(result.id, {
          result,
          score: contribution,
          signals: [list.signal],
        })
      } else {
        existing.score += contribution
        if (!existing.signals.includes(list.signal)) {
          existing.signals.push(list.signal)
        }
      }
    }
  }

  const entries = Array.from(fused.values())
  entries.sort((left, right) => {
    const diff = right.score - left.score
    if (diff !== 0) return diff
    return left.result.id < right.result.id ? -1 : left.result.id > right.result.id ? 1 : 0
  })

  const sliceLimit = Math.min(entries.length, limit)
  const output: FusedSearchResult[] = new Array(sliceLimit)
  for (let i = 0; i < sliceLimit; i++) {
    const item = entries[i]!
    output[i] = { ...item.result, score: item.score, signals: item.signals }
  }

  return output
}
