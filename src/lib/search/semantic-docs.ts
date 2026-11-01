/**
 * Document construction and result shaping for the semantic index (Plan 192
 * split).
 *
 * These are the pure parts of `vector-store.ts`: what text an entity or claim
 * contributes, how a cached snapshot is validated before its vectors are
 * trusted, and how a ranked vector hit becomes the `SearchResult` the UI
 * consumes. None of it touches embeddings, persistence or module state, so it
 * can be read and reasoned about without the build orchestration around it.
 */

import type { Entity, Claim } from '@/lib/studio/types'
import type { SemanticDoc } from './vector-index'
import type { SearchResult } from './retrieval'

/** Snippet length matched to the BM25 result snippet. */
export const SNIPPET_MAX_LENGTH = 140

/** Truncates document text to a display snippet. */
export const makeSnippet = (text: string): string => {
  const trimmed = text.trim()
  if (trimmed.length <= SNIPPET_MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, SNIPPET_MAX_LENGTH)}…`
}

/** The text embedded for an entity — the same fields BM25 indexes. */
export const entityDocText = (entity: Entity): string =>
  `${entity.name} ${entity.description} ${entity.content} ${entity.tags.join(' ')}`

/** The text embedded for a claim. */
export const claimDocText = (claim: Claim): string =>
  `${claim.statement} ${claim.evidence ?? ''} ${claim.source ?? ''}`

/** Builds the searchable documents for a corpus: entities, then their claims. */
export const buildDocs = (entities: Entity[], claims: Claim[]): SemanticDoc[] => {
  const entityMap = new Map(entities.map((e) => [e.id, e]))
  const docs: SemanticDoc[] = []
  for (const entity of entities) {
    docs.push({
      id: entity.id,
      type: 'entity',
      name: entity.name,
      fullText: entityDocText(entity),
      entityType: entity.type,
    })
  }
  for (const claim of claims) {
    const entity = entityMap.get(claim.entityId)
    docs.push({
      id: claim.id,
      type: 'claim',
      name: entity?.name ?? claim.statement,
      fullText: claimDocText(claim),
      entityId: claim.entityId,
      entityName: entity?.name,
      entityType: entity?.type,
    })
  }
  return docs
}

/**
 * Structural shape of a persisted snapshot, as validation sees it.
 *
 * Deliberately not `CachedSemanticDoc`: a snapshot arrives from IndexedDB, so it
 * is hostile input until proven otherwise, and typing it as the trusted type
 * before validating it would make the validation look redundant.
 */
export interface SnapshotLike {
  docs: readonly {
    id: string
    type: string
    name: string
    fullText: string
  }[]
  vectors: readonly { id: string; vector: number[] }[]
}

/**
 * Validates a cached snapshot before its vectors are trusted.
 *
 * A snapshot may be truncated, hand-edited, or written by an older build. The
 * checks that matter are structural: ids unique and paired, vectors the same
 * width and finite. Anything else would let a corrupt cache poison every query
 * until the user cleared storage.
 */
export const isValidSnapshot = (snapshot: SnapshotLike): boolean => {
  if (snapshot.docs.length === 0 || snapshot.docs.length !== snapshot.vectors.length) {
    return snapshot.docs.length === 0 && snapshot.vectors.length === 0
  }
  const ids = new Set(snapshot.docs.map((doc) => doc.id))
  if (ids.size !== snapshot.docs.length) return false
  for (const doc of snapshot.docs) {
    if (
      typeof doc.id !== 'string' ||
      (doc.type !== 'entity' && doc.type !== 'claim') ||
      typeof doc.name !== 'string' ||
      typeof doc.fullText !== 'string'
    ) {
      return false
    }
  }
  const dimensions = snapshot.vectors[0]?.vector.length ?? 0
  if (dimensions === 0) return false
  return snapshot.vectors.every(
    (entry) =>
      ids.has(entry.id) &&
      entry.vector.length === dimensions &&
      entry.vector.every((value) => Number.isFinite(value)),
  )
}

/** Maps ranked vector hits to the search result shape the UI consumes. */
export const toSearchResults = (
  hits: readonly { id: string; score: number; doc: SemanticDoc }[],
): SearchResult[] =>
  hits.map((hit) => ({
    id: hit.doc.id,
    type: hit.doc.type,
    name: hit.doc.type === 'entity' ? hit.doc.name : (hit.doc.entityName ?? hit.doc.name),
    snippet: makeSnippet(hit.doc.fullText),
    score: hit.score,
    entityId: hit.doc.entityId,
    entityName: hit.doc.entityName,
  }))
