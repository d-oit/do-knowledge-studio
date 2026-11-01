/**
 * Deterministic stand-in for the embedding model, used only by the evaluation
 * harness (Issue #1065).
 *
 * The real semantic path needs a ~100 MB ONNX model, so it cannot run in the
 * unit suite. This ranker reproduces the property the harness needs to
 * measure: ranking by *concept* overlap rather than literal token overlap, so
 * a paraphrase matches a document that shares almost no tokens with it. It is
 * cosine similarity over a small hand-written concept space — the same
 * arithmetic the vector path uses, with a table instead of a model.
 *
 * It is not a semantic quality claim. It is a stable control: if fusion stops
 * combining both rankings, the harness fails.
 */

import type { Entity } from '@/lib/studio/types'

/** Concept ids mapped to the surface forms that point at them. */
const CONCEPT_TERMS: Readonly<Record<string, readonly string[]>> = {
  ONBOARDING: ['onboarding', 'onboard', 'hiring', 'hire', 'induction', 'newcomer'],
  RETRIEVAL: ['retrieval', 'search', 'ranking', 'relevance', 'matching'],
  EXPORT: ['export', 'download', 'archive', 'backup'],
  GRAPH: ['graph', 'node', 'edge', 'network'],
  SYNC: ['sync', 'collaboration', 'peer', 'webrtc'],
}

/** One document reduced to its concept counts. */
interface ConceptVector {
  id: string
  weights: Map<string, number>
}

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)

/** Counts the concept terms present in `text`, ignoring term frequency. */
const conceptsOf = (text: string): Map<string, number> => {
  const words = new Set(wordsOf(text))
  const weights = new Map<string, number>()
  for (const [concept, terms] of Object.entries(CONCEPT_TERMS)) {
    const hits = terms.filter((term) => words.has(term)).length
    if (hits > 0) weights.set(concept, hits)
  }
  return weights
}

/** Cosine similarity over concept counts; 0 when either side has no concept. */
const conceptSimilarity = (left: Map<string, number>, right: Map<string, number>): number => {
  if (left.size === 0 || right.size === 0) return 0
  let dot = 0
  for (const [concept, weight] of left) {
    const other = right.get(concept)
    if (other !== undefined) dot += weight * other
  }
  if (dot === 0) return 0
  const norm = (weights: Map<string, number>): number =>
    Math.sqrt(Array.from(weights.values()).reduce((sum, weight) => sum + weight * weight, 0))
  return dot / (norm(left) * norm(right))
}

const documentText = (entity: Entity): string =>
  `${entity.name} ${entity.description} ${entity.content} ${entity.tags.join(' ')}`

/**
 * Ranks entities by concept similarity to `query`.
 *
 * Zero-similarity documents are dropped, so a query outside the concept space
 * returns nothing — the same "no result" contract the lexical engine has.
 * Ties break by id for determinism.
 */
export const rankByConcept = (
  entities: readonly Entity[],
  query: string,
  limit: number,
): string[] => {
  const queryConcepts = conceptsOf(query)
  if (queryConcepts.size === 0) return []

  const vectors: ConceptVector[] = entities.map((entity) => ({
    id: entity.id,
    weights: conceptsOf(documentText(entity)),
  }))

  return vectors
    .map((vector) => ({ id: vector.id, score: conceptSimilarity(queryConcepts, vector.weights) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      left.score === right.score ? left.id.localeCompare(right.id) : right.score - left.score,
    )
    .slice(0, limit)
    .map((entry) => entry.id)
}
