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

/** One retriever's ranking, labelled with the signal it represents. */
export interface RankedList {
  signal: RankSignal
  results: readonly SearchResult[]
}

/** A fused hit plus the retrievers that ranked it. */
export interface FusedSearchResult extends SearchResult {
  /** Signals that contributed, in the order the lists were supplied. */
  signals: RankSignal[]
}

/** One entry's contribution to the fused score at a zero-based rank. */
const rankContribution = (rank: number): number => 1 / (RRF_DAMPING + rank + 1)

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

  for (const list of rankedLists) {
    list.results.forEach((result, rank) => {
      const contribution = rankContribution(rank)
      const existing = fused.get(result.id)
      if (existing === undefined) {
        fused.set(result.id, {
          result: { ...result },
          score: contribution,
          signals: [list.signal],
        })
        return
      }
      existing.score += contribution
      if (!existing.signals.includes(list.signal)) existing.signals.push(list.signal)
    })
  }

  return Array.from(fused.values())
    .sort((left, right) =>
      left.score === right.score
        ? left.result.id.localeCompare(right.result.id)
        : right.score - left.score,
    )
    .slice(0, limit)
    .map(({ result, score, signals }) => ({ ...result, score, signals }))
}
