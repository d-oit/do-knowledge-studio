/**
 * Retrieval-quality metrics for the hybrid-search evaluation harness (Issue
 * #1065).
 *
 * The functions here are deliberately pure and rank-only: they take the id
 * order a strategy returned and the ids a query is labelled with, so lexical,
 * semantic and fused rankings are scored by exactly the same code. No timings,
 * no embedding model, no store — which is what makes the harness deterministic
 * enough to assert on in CI instead of recording a timing baseline.
 */

/** One query paired with the ids a correct retrieval must surface. */
export interface LabelledQuery {
  query: string
  relevantIds: readonly string[]
}

/** Mean ranking quality for one strategy over a labelled query set. */
export interface StrategyMetrics {
  /** Fraction of each query's relevant ids that appear in the top `k`, averaged. */
  recallAtK: number
  /** Mean reciprocal rank of the first relevant hit, averaged over queries. */
  mrr: number
}

/** Ranks already used as the harness cut, and by the library grid's first page. */
export const EVAL_K = 5

/**
 * Fraction of `relevantIds` present in the first `k` ranked ids.
 *
 * A query with no labelled ids scores 0 rather than 1: an unlabelled query is
 * a harness defect, and 0 makes it visible instead of flattering the total.
 */
export const recallAtK = (
  rankedIds: readonly string[],
  relevantIds: readonly string[],
  k: number,
): number => {
  if (relevantIds.length === 0 || k <= 0) return 0
  const topK = new Set(rankedIds.slice(0, k))
  const hits = relevantIds.filter((id) => topK.has(id)).length
  return hits / relevantIds.length
}

/**
 * Reciprocal rank of the first relevant hit (1 for first place, 0 when the
 * ranking contains none of the relevant ids).
 */
export const reciprocalRank = (
  rankedIds: readonly string[],
  relevantIds: readonly string[],
): number => {
  if (relevantIds.length === 0) return 0
  const relevant = new Set(relevantIds)
  const index = rankedIds.findIndex((id) => relevant.has(id))
  return index === -1 ? 0 : 1 / (index + 1)
}

/**
 * Scores `rank` over every labelled query.
 *
 * `rank` is the only thing that differs between strategies, so a lexical,
 * semantic and fused run cannot diverge in how they are measured.
 */
export const evaluateStrategy = (
  queries: readonly LabelledQuery[],
  rank: (query: string) => readonly string[],
  k: number = EVAL_K,
): StrategyMetrics => {
  if (queries.length === 0) return { recallAtK: 0, mrr: 0 }

  let recallSum = 0
  let mrrSum = 0
  for (const entry of queries) {
    const rankedIds = rank(entry.query)
    recallSum += recallAtK(rankedIds, entry.relevantIds, k)
    mrrSum += reciprocalRank(rankedIds, entry.relevantIds)
  }
  return {
    recallAtK: recallSum / queries.length,
    mrr: mrrSum / queries.length,
  }
}
