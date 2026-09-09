/**
 * In-memory multilingual vector index (N1, Issue #751).
 *
 * Documents are derived from the same text fields BM25 indexes (entity
 * name + description + content + tags; claim statement + evidence + source),
 * embedded as batched multilingual passages, and stored L2-normalized so
 * cosine similarity is a plain dot product.
 *
 * Persistence note: embeddings are deliberately NOT written to
 * localStorage/IndexedDB. They are a deterministic function of the corpus,
 * so the index is a recomputable cache: persisting float vectors would
 * duplicate corpus data, risk stale vectors after edits, and burn quota.
 * `snapshot()`/`restore()` keep the door open for a future persistence
 * layer (follow the tiered patterns in lib/studio/indexeddb-backup.ts if one
 * lands).
 */

import type { Entity, Claim } from '@/lib/studio/types'
import {
  embedTexts,
  EMBED_BATCH_SIZE,
  normalizeEmbedding,
  truncateForEmbedding,
} from './embeddings'
import { search, type SearchResult } from './retrieval'

/** Where a semantic result came from — the worker response carries this. */
export type SearchSource = 'semantic' | 'lexical'

/**
 * Discriminated outcome of a semantic search: either ranked vector results
 * or a graceful lexical fallback with the reason surfaced to the UI.
 */
export type SemanticSearchOutcome =
  | { source: 'semantic'; results: SearchResult[] }
  | { source: 'lexical'; results: SearchResult[]; reason: string }

/** A searchable unit: an entity or one of its claims. */
export interface SemanticDoc {
  id: string
  type: 'entity' | 'claim'
  name: string
  fullText: string
  entityId?: string
  entityName?: string
}

/** Optional predicate to narrow vector search by document metadata. */
export type SemanticDocFilter = (doc: SemanticDoc) => boolean

/** Snippet length matched to the BM25 result snippet. */
const SNIPPET_MAX_LENGTH = 140

const makeSnippet = (text: string): string => {
  const trimmed = text.trim()
  if (trimmed.length <= SNIPPET_MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, SNIPPET_MAX_LENGTH)}…`
}

const entityDocText = (entity: Entity): string =>
  `${entity.name} ${entity.description} ${entity.content} ${entity.tags.join(' ')}`

const claimDocText = (claim: Claim): string =>
  `${claim.statement} ${claim.evidence ?? ''} ${claim.source ?? ''}`

const buildDocs = (entities: Entity[], claims: Claim[]): SemanticDoc[] => {
  const entityMap = new Map(entities.map((e) => [e.id, e]))
  const docs: SemanticDoc[] = []
  for (const entity of entities) {
    docs.push({
      id: entity.id,
      type: 'entity',
      name: entity.name,
      fullText: entityDocText(entity),
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
    })
  }
  return docs
}

/** Serializable snapshot of the in-memory index. */
export interface VectorStoreSnapshot {
  docs: SemanticDoc[]
  vectors: { id: string; vector: number[] }[]
}

/** Dot product over pre-normalized vectors (= cosine similarity). */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < len; i += 1) dot += a[i] * b[i]
  return dot
}

/**
 * In-memory vector index mapping document ids to normalized embeddings.
 * Insertions normalize defensively, so raw (unnormalized) vectors are safe.
 */
export class VectorStore {
  private docs = new Map<string, SemanticDoc>()
  private vectors = new Map<string, number[]>()

  /** Number of indexed documents. */
  get size(): number {
    return this.docs.size
  }

  /** Indexes a document with its embedding (normalized on write). */
  add(doc: SemanticDoc, vector: number[]): void {
    this.docs.set(doc.id, doc)
    this.vectors.set(doc.id, normalizeEmbedding(vector))
  }

  /** Indexes or replaces a document with its embedding. */
  upsert(doc: SemanticDoc, vector: number[]): void {
    this.add(doc, vector)
  }

  /** Removes a document (no-op when the id is absent). */
  remove(id: string): void {
    this.docs.delete(id)
    this.vectors.delete(id)
  }

  /** Drops every document and vector. */
  clear(): void {
    this.docs.clear()
    this.vectors.clear()
  }

  /**
   * Returns the top-K documents ranked by cosine similarity to the query
   * vector, optionally restricted by a document filter.
   */
  search(
    queryVector: number[],
    topK = 5,
    filter?: SemanticDocFilter,
  ): { id: string; score: number; doc: SemanticDoc }[] {
    if (this.docs.size === 0 || topK <= 0) return []
    const query = normalizeEmbedding(queryVector)
    const scored: { id: string; score: number; doc: SemanticDoc }[] = []
    for (const [id, doc] of this.docs) {
      if (filter && !filter(doc)) continue
      const vector = this.vectors.get(id)
      if (vector === undefined) continue
      scored.push({ id, score: cosineSimilarity(query, vector), doc })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  /** JSON-safe snapshot for optional persistence. */
  snapshot(): VectorStoreSnapshot {
    return {
      docs: Array.from(this.docs.values()),
      vectors: Array.from(this.vectors.entries()).map(([id, vector]) => ({
        id,
        vector: normalizeEmbedding(vector),
      })),
    }
  }

  /** Replaces the index contents from a snapshot (missing ids are dropped). */
  restore(snapshot: VectorStoreSnapshot): void {
    this.clear()
    for (const doc of snapshot.docs) {
      const vector = snapshot.vectors.find((v) => v.id === doc.id)?.vector
      if (vector !== undefined) this.add(doc, vector)
    }
  }
}

/** Shared index instance backing semantic search. */
export const defaultVectorStore = new VectorStore()

let lastIndexedEntities: Entity[] | null = null
let lastIndexedClaims: Claim[] | null = null
let indexBuilding: Promise<VectorIndexResult> | null = null

/** Clears the module-level index cache so the next search rebuilds it. */
export const resetSemanticCache = (): void => {
  lastIndexedEntities = null
  lastIndexedClaims = null
  indexBuilding = null
  defaultVectorStore.clear()
}

export type VectorIndexResult =
  | { ok: true; count: number }
  | { ok: false; error: string }

/** Embeds every document into the shared store, replacing the previous corpus. */
const doBuildIndex = async (
  entities: Entity[],
  claims: Claim[],
  signal?: AbortSignal,
): Promise<VectorIndexResult> => {
  const docs = buildDocs(entities, claims)
  // The index is a full snapshot of the corpus: clear it first so documents
  // removed from the new arrays cannot linger and rank in later searches.
  defaultVectorStore.clear()
  try {
    for (let offset = 0; offset < docs.length; offset += EMBED_BATCH_SIZE) {
      const batch = docs.slice(offset, offset + EMBED_BATCH_SIZE)
      const texts = batch.map((doc) => truncateForEmbedding(doc.fullText))
      const vectors = await embedTexts(texts, signal)
      for (let i = 0; i < batch.length; i += 1) {
        defaultVectorStore.upsert(batch[i], vectors[i])
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err
    // Clear the partial index so a failed build never feeds a half-ranked
    // search; the error is surfaced as a lexical fallback by the caller.
    defaultVectorStore.clear()
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  lastIndexedEntities = entities
  lastIndexedClaims = claims
  return { ok: true, count: defaultVectorStore.size }
}

const buildVectorIndex = async (
  entities: Entity[],
  claims: Claim[],
  signal?: AbortSignal,
): Promise<VectorIndexResult> => {
  for (;;) {
    if (entities === lastIndexedEntities && claims === lastIndexedClaims) {
      return { ok: true, count: defaultVectorStore.size }
    }
    if (indexBuilding === null) {
      indexBuilding = doBuildIndex(entities, claims, signal)
      const promise = indexBuilding
      // finally() returns a new promise that preserves the original
      // rejection — attach a catch so abort rejections don't surface as an
      // unhandled rejection on the discarded chain (callers still observe
      // them via `promise` itself).
      void promise
        .finally(() => {
          if (indexBuilding === promise) indexBuilding = null
        })
        .catch(noop)
      return promise
    }
    // Another build is in flight — wait for it, then re-check whether it
    // covered our inputs (it may have started with different arrays).
    await indexBuilding.catch(() => undefined)
  }
}

/** Fire-and-forget rejection sink for discarded promise chains. */
const noop = (): void => {}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

const lexicalFallback = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit: number,
  reason: string,
): SemanticSearchOutcome => ({
  source: 'lexical',
  results: search(entities, claims, query, limit),
  reason,
})

/**
 * Runs a semantic search: builds (or reuses) the vector index, embeds the
 * query, and ranks by cosine similarity. When the embedder is unavailable or
 * fails, degrades to lexical BM25 with the reason marked on the outcome so
 * the UI can surface it — never silently returns keyword results.
 *
 * @throws {DOMException} `AbortError` when `signal` fires before completion.
 */
export const semanticSearch = async (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<SemanticSearchOutcome> => {
  const trimmed = query.trim()
  if (trimmed === '') return { source: 'semantic', results: [] }

  const buildResult = await buildVectorIndex(entities, claims, signal)
  if (!buildResult.ok) {
    return lexicalFallback(entities, claims, trimmed, limit, buildResult.error)
  }

  let queryVector: number[]
  try {
    const vectors = await embedTexts([trimmed], signal)
    queryVector = vectors[0]
  } catch (err) {
    if (isAbortError(err)) throw err
    const reason = err instanceof Error ? err.message : String(err)
    return lexicalFallback(entities, claims, trimmed, limit, reason)
  }

  const hits = defaultVectorStore.search(queryVector, limit)
  const results: SearchResult[] = hits.map((hit) => ({
    id: hit.doc.id,
    type: hit.doc.type,
    name: hit.doc.type === 'entity' ? hit.doc.name : (hit.doc.entityName ?? hit.doc.name),
    snippet: makeSnippet(hit.doc.fullText),
    score: hit.score,
    entityId: hit.doc.entityId,
    entityName: hit.doc.entityName,
  }))
  return { source: 'semantic', results }
}