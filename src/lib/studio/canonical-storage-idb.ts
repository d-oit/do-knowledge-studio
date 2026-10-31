/**
 * Low-level IndexedDB primitives for canonical studio persistence (#1036).
 *
 * Kept separate from the migration/fallback policy so the storage adapter
 * stays under the repository's module-size limit and transaction handling has
 * one reviewable home.
 */
import type { StorageValue } from 'zustand/middleware'
import { logger } from '@/lib/logging/logger'

/** IndexedDB database holding the canonical corpus envelope. */
export const CANONICAL_DB_NAME = 'dks-canonical'
/** Object store holding exactly one canonical envelope record. */
export const CANONICAL_OBJECT_STORE = 'state'
/** Key of the canonical envelope record. */
export const CANONICAL_RECORD_KEY = 'studio-corpus'

const log = logger.child({ area: 'store' })

let dbPromise: Promise<IDBDatabase> | null = null

/** Open (and cache) the canonical database. */
export const openCanonicalDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise !== null) return dbPromise
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>()
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB is not available'))
    dbPromise = promise
    return promise
  }
  const request = indexedDB.open(CANONICAL_DB_NAME, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(CANONICAL_OBJECT_STORE)) {
      db.createObjectStore(CANONICAL_OBJECT_STORE)
    }
  }
  request.onsuccess = () => {
    const db = request.result
    db.onversionchange = () => {
      db.close()
      dbPromise = null
    }
    resolve(db)
  }
  request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  request.onblocked = () => reject(new Error('IndexedDB open was blocked by another tab'))
  dbPromise = promise
  return promise
}

/** Read the canonical envelope, or null when no record exists. */
export const readIndexedEnvelope = async (): Promise<StorageValue<unknown> | null> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<unknown>()
  const transaction = db.transaction(CANONICAL_OBJECT_STORE, 'readonly')
  const request = transaction.objectStore(CANONICAL_OBJECT_STORE).get(CANONICAL_RECORD_KEY)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  const value = await promise
  if (value === undefined) return null
  if (typeof value !== 'object' || value === null || !('state' in value)) {
    throw new Error('canonical record is not a { state, version } object')
  }
  return value as StorageValue<unknown>
}

/** Write the canonical envelope in one atomic transaction. */
export const writeIndexedEnvelope = async (value: StorageValue<unknown>): Promise<void> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  let transaction: IDBTransaction
  try {
    transaction = db.transaction(CANONICAL_OBJECT_STORE, 'readwrite')
  } catch (error) {
    reject(error)
    return promise
  }
  transaction.oncomplete = () => resolve()
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  try {
    transaction.objectStore(CANONICAL_OBJECT_STORE).put(value, CANONICAL_RECORD_KEY)
  } catch (error) {
    reject(error)
  }
  return promise
}

/** Remove the canonical envelope. */
export const deleteIndexedEnvelope = async (): Promise<void> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const transaction = db.transaction(CANONICAL_OBJECT_STORE, 'readwrite')
  transaction.oncomplete = () => resolve()
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  transaction.objectStore(CANONICAL_OBJECT_STORE).delete(CANONICAL_RECORD_KEY)
  return promise
}

/** Close the cached database handle (tests/reset). */
export const closeCanonicalDatabase = async (): Promise<void> => {
  const pending = dbPromise
  dbPromise = null
  if (pending === null) return
  try {
    ;(await pending).close()
  } catch (error) {
    log.warn('Failed to close the canonical test database', { error })
  }
}

/** Delete the canonical database (tests only). */
export const deleteCanonicalDatabase = async (): Promise<void> => {
  await closeCanonicalDatabase()
  if (typeof indexedDB === 'undefined') return
  const { promise, resolve } = Promise.withResolvers<void>()
  const request = indexedDB.deleteDatabase(CANONICAL_DB_NAME)
  request.onsuccess = () => resolve()
  request.onerror = () => resolve()
  request.onblocked = () => resolve()
  await promise
}
