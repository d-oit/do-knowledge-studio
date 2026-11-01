/**
 * In-memory multilingual vector index (N1, Issue #751; incremental Issue #1037).
 *
 * Documents are derived from the same text fields BM25 indexes (entity
 * name + description + content + tags; claim statement + evidence + source),
 * embedded as batched multilingual passages, and stored L2-normalized so
 * cosine similarity is a plain dot product.
 *
 * The index is a derived cache. An update embeds only added/changed documents,
 * removes deleted ids immediately, commits changed vectors atomically after a
 * successful build, and persists the result in IndexedDB behind a model +
 * preprocessing + corpus-digest fingerprint. A cancelled or failed build keeps
 * the previous valid vectors, so it cannot poison later queries.
 *
 * Split from its pure helpers (Plan 192): document construction and snapshot
 * validation live in `semantic-docs.ts`, the memory budget in
 * `semantic-budget.ts`. What remains here is the stateful orchestration —
 * incremental staging, cache restore, progress and the public search entry
 * point.
 */

import type { Entity, Claim } from '@/lib/studio/types'
import {
  disposeEmbedder,
  embedTexts,
  EMBED_BATCH_SIZE,
  truncateForEmbedding,
} from './embeddings'
import {
  computeCorpusDigest,
  fingerprintOf,
  SEMANTIC_MODEL_FINGERPRINT,
} from './semantic-digest'
import { search, type SearchResult, type SearchFilter } from './retrieval'
import {
  FUSION_LEXICAL_WEIGHT,
  reciprocalRankFusion,
  type FusedSearchResult,
} from './fusion'
import {
  VectorStore,
  type SemanticDoc,
  type SemanticDocFilter,
  type VectorStoreSnapshot,
} from './vector-index'
import {
  clearSemanticCache,
  loadSemanticCache,
  saveSemanticCache,
  type CachedSemanticDoc,
} from './semantic-cache'
import { setSemanticIndexProgress } from './semantic-progress'
import { buildDocs, isValidSnapshot, toSearchResults } from './semantic-docs'
import {
  ASSUMED_EMBEDDING_DIMENSIONS,
  estimateIndexBytes,
  getSemanticIndexBudget,
} from './semantic-budget'

export {
  getSemanticIndexProgress,
  subscribeSemanticIndexProgress,
  type SemanticIndexProgress,
  type SemanticIndexStatus,
} from './semantic-progress'
export { cosineSimilarity, VectorStore } from './vector-index'
export { SEMANTIC_INDEX_MAX_BYTES, setSemanticIndexBudgetForTests } from './semantic-budget'

/** Where a search result came from — the worker response carries this. */
export type SearchSource = 'hybrid' | 'lexical'

/**
 * Discriminated outcome of a semantic search: either a fused semantic + BM25
 * ranking, or a graceful lexical fallback with the reason surfaced to the UI.
 */
export type SemanticSearchOutcome =
  | { source: 'hybrid'; results: FusedSearchResult[] }
  | { source: 'lexical'; results: SearchResult[]; reason: string }

/** Re-exported so callers can type the per-hit retriever signals. */
export type { FusedSearchResult, RankSignal } from './fusion'

export type { SemanticDoc, SemanticDocFilter, VectorStoreSnapshot }

export { SEMANTIC_MODEL_FINGERPRINT }

/** Shared index instance backing semantic search. */
export const defaultVectorStore = new VectorStore()

let lastIndexedEntities: Entity[] | null = null
let lastIndexedClaims: Claim[] | null = null
let indexBuilding: Promise<VectorIndexResult> | null = null
let indexedFingerprints = new Map<string, string>()
let indexedCorpusDigest: string | null = null
let indexedDimensions: number | null = null
let cacheCheckedDigest: string | null = null

/** Clears the module-level index cache so the next search rebuilds it. */
export const resetSemanticCache = (): void => {
  lastIndexedEntities = null
  lastIndexedClaims = null
  indexBuilding = null
  indexedFingerprints = new Map()
  indexedCorpusDigest = null
  indexedDimensions = null
  cacheCheckedDigest = null
  defaultVectorStore.clear()
  // Explicit reset is the point where the WASM model and derived vectors can
  // be released instead of staying resident for the rest of the session.
  disposeEmbedder()
  setSemanticIndexProgress({ status: 'idle', completed: 0, total: 0, reason: null })
  void clearSemanticCache()
}

export type VectorIndexResult =
  | { ok: true; count: number }
  | { ok: false; error: string }

/** Yield to the event loop between bounded embedding batches. */
const yieldToMainThread = (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, 0)
  return promise
}

/** Restore a verified cache snapshot into the live index. */
const restoreSnapshot = (
  snapshot: { docs: CachedSemanticDoc[]; vectors: { id: string; vector: number[] }[] },
): void => {
  const docs = snapshot.docs as SemanticDoc[]
  defaultVectorStore.restore({ docs, vectors: snapshot.vectors })
  indexedFingerprints = new Map(docs.map((doc) => [doc.id, fingerprintOf(doc)]))
  indexedDimensions = snapshot.vectors[0]?.vector.length ?? null
}

/** Stage embeddings for changed docs, committing only after every batch succeeds. */
const embedChangedDocs = async (
  changed: SemanticDoc[],
  signal: AbortSignal | undefined,
  total: number,
  alreadyDone: number,
): Promise<{ ok: true; vectors: Map<string, number[]>; dimensions: number } | { ok: false; error: string }> => {
  const vectors = new Map<string, number[]>()
  let dimensions = indexedDimensions
  let completed = alreadyDone
  for (let offset = 0; offset < changed.length; offset += EMBED_BATCH_SIZE) {
    if (signal?.aborted) throw abortError()
    const batch = changed.slice(offset, offset + EMBED_BATCH_SIZE)
    const embedded = await embedTexts(
      batch.map((doc) => truncateForEmbedding(doc.fullText)),
      signal,
    )
    if (embedded.length !== batch.length) {
      return { ok: false, error: 'embedding batch returned an unexpected vector count' }
    }
    if (dimensions === null) {
      dimensions = embedded[0]?.length ?? null
      if (dimensions === null || dimensions === 0) {
        return { ok: false, error: 'embedding model returned empty vectors' }
      }
    }
    for (let i = 0; i < batch.length; i += 1) {
      if (embedded[i].length !== dimensions) {
        return { ok: false, error: 'embedding model changed vector dimensions mid-build' }
      }
      vectors.set(batch[i].id, embedded[i])
    }
    completed += batch.length
    setSemanticIndexProgress({ status: 'indexing', completed, total, reason: null })
    await yieldToMainThread()
  }
  return { ok: true, vectors, dimensions: dimensions ?? ASSUMED_EMBEDDING_DIMENSIONS }
}

/** Embed every changed document and commit the incremental result. */
const doBuildIndex = async (
  entities: Entity[],
  claims: Claim[],
  signal?: AbortSignal,
): Promise<VectorIndexResult> => {
  const docs = buildDocs(entities, claims)
  const nextIds = new Set(docs.map((doc) => doc.id))
  const digest = await computeCorpusDigest(docs)

  // Deleted documents must disappear even if the subsequent embed is aborted.
  for (const id of defaultVectorStore.ids()) {
    if (!nextIds.has(id)) {
      defaultVectorStore.remove(id)
      indexedFingerprints.delete(id)
    }
  }

  const changed = docs.filter(
    (doc) => indexedFingerprints.get(doc.id) !== fingerprintOf(doc) || !defaultVectorStore.has(doc.id),
  )

  if (changed.length === 0 && digest === indexedCorpusDigest) {
    lastIndexedEntities = entities
    lastIndexedClaims = claims
    setSemanticIndexProgress({ status: 'ready', completed: docs.length, total: docs.length, reason: null })
    return { ok: true, count: defaultVectorStore.size }
  }

  if (cacheCheckedDigest !== digest && indexedCorpusDigest !== digest) {
    cacheCheckedDigest = digest
    if (signal?.aborted) throw abortError()
    setSemanticIndexProgress({ status: 'loading-cache', completed: 0, total: docs.length, reason: null })
    const cached = await loadSemanticCache({ modelFingerprint: SEMANTIC_MODEL_FINGERPRINT, corpusDigest: digest })
    if (cached !== null && isValidSnapshot(cached)) {
      restoreSnapshot(cached)
      lastIndexedEntities = entities
      lastIndexedClaims = claims
      indexedCorpusDigest = digest
      setSemanticIndexProgress({ status: 'ready', completed: docs.length, total: docs.length, reason: null })
      return { ok: true, count: defaultVectorStore.size }
    }
  }

  const dimensions = indexedDimensions ?? ASSUMED_EMBEDDING_DIMENSIONS
  if (estimateIndexBytes(docs, dimensions) > getSemanticIndexBudget()) {
    const error = 'semantic index exceeds the configured memory budget'
    setSemanticIndexProgress({ status: 'error', completed: 0, total: docs.length, reason: error })
    return { ok: false, error }
  }

  if (changed.length === 0) {
    indexedCorpusDigest = digest
    lastIndexedEntities = entities
    lastIndexedClaims = claims
    setSemanticIndexProgress({ status: 'ready', completed: docs.length, total: docs.length, reason: null })
    return { ok: true, count: defaultVectorStore.size }
  }

  setSemanticIndexProgress({
    status: 'indexing',
    completed: docs.length - changed.length,
    total: docs.length,
    reason: null,
  })

  let staged: { ok: true; vectors: Map<string, number[]>; dimensions: number } | { ok: false; error: string }
  try {
    staged = await embedChangedDocs(changed, signal, docs.length, docs.length - changed.length)
  } catch (error) {
    if (signal?.aborted) {
      setSemanticIndexProgress({
        status: 'cancelled',
        completed: docs.length - changed.length,
        total: docs.length,
        reason: 'semantic indexing cancelled',
      })
      throw error
    }
    const reason = error instanceof Error ? error.message : String(error)
    setSemanticIndexProgress({ status: 'error', completed: 0, total: docs.length, reason })
    return { ok: false, error: reason }
  }
  if (!staged.ok) {
    setSemanticIndexProgress({ status: 'error', completed: 0, total: docs.length, reason: staged.error })
    return staged
  }

  if (estimateIndexBytes(docs, staged.dimensions) > getSemanticIndexBudget()) {
    const error = 'semantic index exceeds the configured memory budget'
    setSemanticIndexProgress({ status: 'error', completed: 0, total: docs.length, reason: error })
    return { ok: false, error }
  }

  for (const doc of changed) {
    const vector = staged.vectors.get(doc.id)
    if (vector === undefined) {
      return { ok: false, error: 'embedding stage lost a document' }
    }
    defaultVectorStore.upsert(doc, vector)
    indexedFingerprints.set(doc.id, fingerprintOf(doc))
  }

  indexedCorpusDigest = digest
  indexedDimensions = staged.dimensions
  lastIndexedEntities = entities
  lastIndexedClaims = claims
  setSemanticIndexProgress({ status: 'ready', completed: docs.length, total: docs.length, reason: null })
  const snapshot = defaultVectorStore.snapshot()
  await saveSemanticCache(
    {
      modelFingerprint: SEMANTIC_MODEL_FINGERPRINT,
      dimensions: staged.dimensions,
      corpusDigest: digest,
    },
    {
      docs: snapshot.docs as CachedSemanticDoc[],
      vectors: snapshot.vectors,
    },
  )
  return { ok: true, count: defaultVectorStore.size }
}

/** The cancellation error every abort path in this module rejects with. */
const abortError = (): Error => new DOMException('Semantic search aborted', 'AbortError')

/**
 * Resolves with the awaitable's result unless `signal` fires first, in which
 * case it rejects with AbortError and cleans up its listener.
 */
const raceWithAbort = async <T>(awaitable: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (signal?.aborted) throw abortError()
  if (!signal) return awaitable
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  const onAbort = (): void => reject(abortError())
  signal.addEventListener('abort', onAbort)
  awaitable.then(
    (value) => resolve(value),
    (err) => reject(err),
  )
  try {
    return await promise
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

const buildVectorIndex = async (
  entities: Entity[],
  claims: Claim[],
  signal?: AbortSignal,
): Promise<VectorIndexResult> => {
  for (;;) {
    if (signal?.aborted) throw abortError()
    if (entities === lastIndexedEntities && claims === lastIndexedClaims) {
      return { ok: true, count: defaultVectorStore.size }
    }
    if (indexBuilding === null) {
      const promise = doBuildIndex(entities, claims, signal)
      indexBuilding = promise
      try {
        return await promise
      } finally {
        if (indexBuilding === promise) indexBuilding = null
      }
    }
    await raceWithAbort(indexBuilding.catch(() => undefined), signal)
  }
}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

const lexicalFallback = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit: number,
  reason: string,
  filter?: SearchFilter,
): SemanticSearchOutcome => ({
  source: 'lexical',
  results: search(entities, claims, query, limit, filter),
  reason,
})

/**
 * Runs a semantic search: incrementally builds (or reuses) the vector index,
 * embeds the query, and ranks by cosine similarity. When the vector path is
 * available it is fused with a BM25 ranking via reciprocal rank fusion, so a
 * document that one engine ranks strongly is not lost to the other; when the
 * embedder is unavailable, the corpus exceeds the memory budget, or the build
 * fails, it degrades to lexical BM25 with the reason marked on the outcome.
 *
 * @throws {DOMException} `AbortError` when `signal` fires before completion.
 */
export const semanticSearch = async (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit = 5,
  signal?: AbortSignal,
  filter?: SearchFilter,
): Promise<SemanticSearchOutcome> => {
  const trimmed = query.trim()
  if (trimmed === '') return { source: 'hybrid', results: [] }

  const buildResult = await buildVectorIndex(entities, claims, signal)
  if (!buildResult.ok) {
    return lexicalFallback(entities, claims, trimmed, limit, buildResult.error, filter)
  }

  let queryVector: number[]
  try {
    const vectors = await embedTexts([trimmed], signal)
    queryVector = vectors[0]
  } catch (err) {
    if (isAbortError(err)) throw err
    const reason = err instanceof Error ? err.message : String(err)
    return lexicalFallback(entities, claims, trimmed, limit, reason, filter)
  }

  const revalidated = await buildVectorIndex(entities, claims, signal)
  if (!revalidated.ok) {
    return lexicalFallback(entities, claims, trimmed, limit, revalidated.error, filter)
  }

  const hits = defaultVectorStore.search(queryVector, limit, filter)
  // Both engines honor the same filter and limit, so fusion ranks within the
  // same narrowed candidate set the UI asked for.
  const semanticResults = toSearchResults(hits)
  const lexicalResults = search(entities, claims, trimmed, limit, filter)
  return {
    source: 'hybrid',
    results: reciprocalRankFusion(
      [
        { signal: 'semantic', results: semanticResults },
        // Weighted, not equal: plain RRF let lexical agreement demote correct
        // semantic hits (see FUSION_LEXICAL_WEIGHT for the measurements).
        { signal: 'lexical', results: lexicalResults, weight: FUSION_LEXICAL_WEIGHT },
      ],
      limit,
    ),
  }
}
