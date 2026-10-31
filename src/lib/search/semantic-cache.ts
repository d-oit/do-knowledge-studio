/**
 * IndexedDB cache for the derived semantic index (Issue #1037).
 *
 * Embeddings are a deterministic cache, not canonical data. The record is
 * accepted only when the model/preprocessing fingerprint, vector dimensions,
 * and corpus digest all match. Anything else is deleted and rebuilt; a stale
 * vector can therefore never answer a search.
 */
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for semantic-cache logs. */
const log = logger.child({ area: 'search' })

/** IndexedDB database holding the derived vector index. */
export const SEMANTIC_CACHE_DB_NAME = 'dks-semantic-cache'
/** Object store holding the single index record. */
export const SEMANTIC_CACHE_STORE = 'index'
/** Record key for the current cache format. */
export const SEMANTIC_CACHE_RECORD_KEY = 'vector-index'
/** Version of the cache record shape. */
export const SEMANTIC_CACHE_FORMAT_VERSION = 1

/** Minimal document shape persisted alongside its vector. */
export interface CachedSemanticDoc {
  id: string
  type: 'entity' | 'claim'
  name: string
  fullText: string
  entityId?: string
  entityName?: string
  entityType?: string
}

/** Snapshot accepted by the vector store. */
export interface CachedVectorSnapshot {
  docs: CachedSemanticDoc[]
  vectors: { id: string; vector: number[] }[]
}

/** Metadata that must match before a cached snapshot is trusted. */
export interface SemanticCacheMetadata {
  formatVersion: number
  modelFingerprint: string
  dimensions: number
  corpusDigest: string
  savedAt: string
}

interface SemanticCacheRecord extends SemanticCacheMetadata {
  snapshot: CachedVectorSnapshot
}

let dbPromise: Promise<IDBDatabase> | null = null

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise !== null) return dbPromise
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>()
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB is not available'))
    dbPromise = promise
    return promise
  }
  const request = indexedDB.open(SEMANTIC_CACHE_DB_NAME, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(SEMANTIC_CACHE_STORE)) {
      db.createObjectStore(SEMANTIC_CACHE_STORE)
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Semantic cache open failed'))
  request.onblocked = () => reject(new Error('Semantic cache open was blocked'))
  dbPromise = promise
  return promise
}

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> => {
  const db = await openDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<T | undefined>()
  const transaction = db.transaction(SEMANTIC_CACHE_STORE, mode)
  transaction.oncomplete = () => resolve(undefined)
  transaction.onabort = () => reject(transaction.error ?? new Error('Semantic cache transaction aborted'))
  transaction.onerror = () => reject(transaction.error ?? new Error('Semantic cache transaction failed'))
  const request = operation(transaction.objectStore(SEMANTIC_CACHE_STORE))
  if (request) {
    request.onsuccess = () => resolve(request.result)
  }
  return promise
}

/** Validate the persisted record without trusting its shape. */
const isCacheRecord = (value: unknown): value is SemanticCacheRecord => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<SemanticCacheRecord>
  return (
    record.formatVersion === SEMANTIC_CACHE_FORMAT_VERSION &&
    typeof record.modelFingerprint === 'string' &&
    typeof record.corpusDigest === 'string' &&
    typeof record.dimensions === 'number' &&
    Array.isArray(record.snapshot?.docs) &&
    Array.isArray(record.snapshot?.vectors)
  )
}

/**
 * Load a snapshot only when its model fingerprint and corpus digest match.
 * A mismatched or corrupt record is deleted so it cannot be retried forever.
 */
export const loadSemanticCache = async (expected: {
  modelFingerprint: string
  corpusDigest: string
}): Promise<CachedVectorSnapshot | null> => {
  try {
    const value = await runTransaction('readonly', (store) => store.get(SEMANTIC_CACHE_RECORD_KEY))
    if (!isCacheRecord(value)) {
      if (value !== undefined) {
        log.warn('Discarding an invalid semantic cache record')
        await clearSemanticCache()
      }
      return null
    }
    if (
      value.modelFingerprint !== expected.modelFingerprint ||
      value.corpusDigest !== expected.corpusDigest
    ) {
      return null
    }
    return value.snapshot
  } catch (error) {
    log.warn('Semantic cache could not be read', { error })
    return null
  }
}

/** Persist a completed index. Failure never fails the in-memory index. */
export const saveSemanticCache = async (
  metadata: Omit<SemanticCacheMetadata, 'formatVersion' | 'savedAt'>,
  snapshot: CachedVectorSnapshot,
): Promise<void> => {
  const record: SemanticCacheRecord = {
    formatVersion: SEMANTIC_CACHE_FORMAT_VERSION,
    ...metadata,
    savedAt: new Date().toISOString(),
    snapshot,
  }
  try {
    await runTransaction('readwrite', (store) => {
      store.put(record, SEMANTIC_CACHE_RECORD_KEY)
    })
  } catch (error) {
    log.warn('Semantic cache could not be written', { error })
  }
}

/** Delete the cached record; used by explicit reset and invalidation. */
export const clearSemanticCache = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') return
  try {
    await runTransaction('readwrite', (store) => {
      store.delete(SEMANTIC_CACHE_RECORD_KEY)
    })
  } catch (error) {
    log.warn('Semantic cache could not be cleared', { error })
  }
}

/** Reset the cached database handle (tests). */
export const resetSemanticCacheConnectionForTests = (): void => {
  const pending = dbPromise
  dbPromise = null
  if (pending !== null) {
    void pending.then((db) => db.close()).catch(() => undefined)
  }
}
