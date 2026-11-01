/**
 * The three retrieval strategies the evaluation harness scores, expressed as
 * rank-returning functions so the same code ranks the synthetic fixture and the
 * real seed corpus.
 *
 * Keeping them here rather than in each test is what makes the two harnesses
 * comparable: a metric difference between the fixture and the seed corpus
 * cannot come from a different fusion call.
 */

import type { Entity, Claim } from '@/lib/studio/types'
import { search, type SearchResult } from '../retrieval'
import { reciprocalRankFusion } from '../fusion'
import { rankByConcept } from './concept-ranker'

/** Ranked ids from the BM25 engine. */
export const lexicalRankIds = (
  entities: readonly Entity[],
  claims: readonly Claim[],
  query: string,
  limit: number,
): string[] => search([...entities], [...claims], query, limit).map((result) => result.id)

/** Ranked ids from the concept ranker that stands in for the embedding model. */
export const conceptRankIds = (
  entities: readonly Entity[],
  query: string,
  limit: number,
): string[] => rankByConcept(entities, query, limit)

/**
 * Fuses a BM25 ranking with an already-ranked list of semantic ids.
 *
 * Takes ids rather than a ranker so the same fusion step serves the concept
 * stand-in and the real embedding model; a strategy difference can then only
 * come from the semantic ranking itself.
 */
export const fuseWithSemanticIds = (
  entities: readonly Entity[],
  claims: readonly Claim[],
  query: string,
  semanticIds: readonly string[],
  limit: number,
): string[] => {
  const lexical = search([...entities], [...claims], query, limit)
  const semantic: SearchResult[] = semanticIds.map((id) => {
    const entity = entities.find((candidate) => candidate.id === id)
    return {
      id,
      type: 'entity',
      name: entity?.name ?? id,
      snippet: entity?.description ?? '',
      score: 0,
    }
  })
  return reciprocalRankFusion(
    [
      { signal: 'semantic', results: semantic },
      { signal: 'lexical', results: lexical },
    ],
    limit,
  ).map((result) => result.id)
}

/** Ranked ids after fusing the concept and BM25 rankings with RRF. */
export const hybridRankIds = (
  entities: readonly Entity[],
  claims: readonly Claim[],
  query: string,
  limit: number,
): string[] =>
  fuseWithSemanticIds(
    entities,
    claims,
    query,
    rankByConcept(entities, query, limit),
    limit,
  )
