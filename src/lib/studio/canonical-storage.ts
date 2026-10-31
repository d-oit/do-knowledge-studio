/**
 * Canonical IndexedDB persistence for the studio corpus (Issue #1036).
 *
 * Zustand remains the in-memory UI store. This module supplies the
 * `PersistStorage` adapter that keeps the large `{ state, version }` envelope in
 * IndexedDB via structured clone, plus a small localStorage metadata envelope
 * for boot diagnostics and schema-version checks.
 *
 * The legacy localStorage envelope is moved once, atomically:
 *   1. read and parse the legacy envelope;
 *   2. write it to IndexedDB;
 *   3. read it back and compare;
 *   4. write the metadata envelope;
 *   5. only then remove the legacy live key.
 *
 * Any failure leaves the legacy bytes untouched and keeps this session on the
 * legacy fallback, because losing the only copy is worse than staying on a
 * slower store for one session. A version mismatch is never migrated eagerly:
 * zustand's migration/refusal path must decide first, and canonical writes from
 * that path move the migrated envelope when it succeeds.
 */
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY } from './hydration'
import { getGuardedStorage, isSyncBlocked } from './hydration-guard'
import {
  CANONICAL_DB_NAME,
  CANONICAL_OBJECT_STORE,
  CANONICAL_RECORD_KEY,
  deleteCanonicalDatabase,
  deleteIndexedEnvelope,
  readIndexedEnvelope,
  writeIndexedEnvelope,
} from './canonical-storage-idb'
import { logger } from '@/lib/logging/logger'

export { CANONICAL_DB_NAME, CANONICAL_OBJECT_STORE, CANONICAL_RECORD_KEY }

/** Subsystem tag for canonical-storage logs. */
const log = logger.child({ area: 'store' })

/** localStorage key for the small, non-canonical metadata envelope. */
export const CANONICAL_META_KEY = 'do-knowledge-studio-store-meta'
/** One-time rollback copy of a legacy envelope whose migration failed. */
export const CANONICAL_MIGRATION_BACKUP_KEY = 'do-knowledge-studio-store-pre-indexeddb'
/** Version of the metadata envelope shape. */
export const CANONICAL_META_FORMAT_VERSION = 1

/** Where the current session's canonical writes are going. */
export type CanonicalStorageMode =
  | 'indexeddb'
  | 'legacy-fallback'
  | 'unavailable'
  | 'write-failed'

/** Small, non-canonical boot metadata written to localStorage. */
export interface CanonicalMetadata {
  formatVersion: number
  schemaVersion: number
  updatedAt: string
  entityCount: number
  claimCount: number
  storage: 'indexeddb'
}

/** Snapshot of the adapter's last known mode and failure reason. */
export interface CanonicalStorageStatus {
  mode: CanonicalStorageMode
  reason: string | null
}

let cachedRaw: string | null = null
let hasCachedEnvelope = false
let mode: CanonicalStorageMode = 'unavailable'
let failureReason: string | null = null
/**
 * Sticky legacy routing for a session where IndexedDB is unavailable or a
 * migration failed. A version-mismatch read is NOT sticky: zustand's migration
 * path runs next and its successful write must move the envelope to IDB.
 */
let preferLegacy = false
const statusListeners = new Set<() => void>()

/** The most recent read/migration outcome, for diagnostics and tests. */
export const getCanonicalStorageStatus = (): CanonicalStorageStatus => ({
  mode,
  reason: failureReason,
})

/** Subscribes to canonical-storage mode changes; returns an unsubscribe. */
export const subscribeToCanonicalStorageStatus = (listener: () => void): (() => void) => {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

const setStatus = (nextMode: CanonicalStorageMode, reason: string | null = null): void => {
  mode = nextMode
  failureReason = reason
  for (const listener of statusListeners) {
    try {
      listener()
    } catch (error) {
      log.error('Canonical storage status listener failed', { error })
    }
  }
}

/** Safe localStorage accessor; returns null when the browser blocks it. */
const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch (error) {
    log.warn('Browser localStorage is unavailable', { error })
    return null
  }
}

/** Read the legacy Zustand envelope verbatim. */
const readLegacyRaw = (): string | null => {
  const storage = getLocalStorage()
  if (storage === null) return null
  // A read failure is deliberately propagated: zustand turns it into the
  // store's fail-closed refusal path instead of treating blocked storage as a
  // first run that is safe to overwrite.
  return storage.getItem(STUDIO_STORAGE_KEY)
}

/** Persist writes to the legacy key through the fail-closed guard. */
const legacyStorage = (): StateStorage | null => {
  try {
    return getGuardedStorage()
  } catch {
    return null
  }
}

/** Parse a legacy envelope without letting a malformed payload escape. */
const parseLegacy = (raw: string): StorageValue<unknown> => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) {
    throw new Error('legacy envelope is not a { state, version } object')
  }
  return parsed as StorageValue<unknown>
}

/** Build the small metadata envelope from a full persisted value. */
const buildMetadata = (value: StorageValue<unknown>): CanonicalMetadata => {
  const state =
    typeof value.state === 'object' && value.state !== null ? value.state : {}
  const entities = 'entities' in state && Array.isArray(state.entities) ? state.entities : []
  const claims = 'claims' in state && Array.isArray(state.claims) ? state.claims : []
  return {
    formatVersion: CANONICAL_META_FORMAT_VERSION,
    schemaVersion: typeof value.version === 'number' ? value.version : CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    entityCount: entities.length,
    claimCount: claims.length,
    storage: 'indexeddb',
  }
}

/** Write the metadata envelope; metadata failure never fails the corpus write. */
const writeMetadata = (value: StorageValue<unknown>): void => {
  const storage = getLocalStorage()
  if (storage === null) return
  try {
    storage.setItem(CANONICAL_META_KEY, JSON.stringify(buildMetadata(value)))
  } catch (error) {
    log.warn('Failed to write the studio storage metadata envelope', { error })
  }
}

/** Read the metadata envelope defensively; used only to detect a prior IDB store. */
const readMetadata = (): CanonicalMetadata | null => {
  const storage = getLocalStorage()
  if (storage === null) return null
  try {
    const raw = storage.getItem(CANONICAL_META_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as CanonicalMetadata
  } catch (error) {
    log.warn('Ignored unreadable studio storage metadata', { error })
    return null
  }
}

/** Remove the legacy live key after a verified canonical write. */
const removeLegacyAfterVerifiedWrite = (): void => {
  const storage = getLocalStorage()
  if (storage === null) return
  try {
    storage.removeItem(STUDIO_STORAGE_KEY)
    storage.removeItem(CANONICAL_MIGRATION_BACKUP_KEY)
  } catch (error) {
    log.warn('Failed to remove the migrated legacy studio envelope', { error })
  }
}

/**
 * Keep a rollback copy before a failed migration can be superseded by
 * fallback writes to the live legacy key.
 */
const preserveMigrationRollback = (raw: string): void => {
  const storage = getLocalStorage()
  if (storage === null) return
  try {
    if (storage.getItem(CANONICAL_MIGRATION_BACKUP_KEY) === null) {
      storage.setItem(CANONICAL_MIGRATION_BACKUP_KEY, raw)
    }
  } catch (error) {
    log.warn('Failed to preserve the pre-migration studio envelope', { error })
  }
}

/** Cache raw bytes for the synchronous quarantine path. */
const cache = (value: StorageValue<unknown> | null, raw: string | null): void => {
  hasCachedEnvelope = value !== null
  cachedRaw = value === null ? null : (raw ?? JSON.stringify(value))
}

/** Deep structural comparison for the one-time migration read-back. */
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Move a same-version legacy envelope into IndexedDB.
 *
 * Returns the parsed value on success and `null` when migration did not run or
 * failed. The caller decides whether to fall back to the legacy read; a failed
 * migration never removes or rewrites the legacy bytes.
 */
const migrateLegacyEnvelope = async (raw: string): Promise<StorageValue<unknown> | null> => {
  let parsed: StorageValue<unknown>
  try {
    parsed = parseLegacy(raw)
  } catch (error) {
    log.warn('Legacy studio envelope could not be parsed; leaving it in place', { error })
    return null
  }

  // Version mismatches belong to zustand's migrate/refusal path. Migrating them
  // eagerly would move a future build's payload before this build decides it
  // cannot safely read it.
  if (typeof parsed.version === 'number' && parsed.version !== CURRENT_SCHEMA_VERSION) {
    return null
  }

  try {
    await writeIndexedEnvelope(parsed)
    const verified = await readIndexedEnvelope()
    if (!sameJson(verified, parsed)) {
      throw new Error('IndexedDB read-back did not match the legacy envelope')
    }
    writeMetadata(parsed)
    removeLegacyAfterVerifiedWrite()
    setStatus('indexeddb')
    return parsed
  } catch (error) {
    log.error('Failed to migrate the legacy studio envelope to IndexedDB', { error })
    // The failed write could be a half-usable record; remove only the record
    // this migration wrote (there was none before this attempt). Keeping it
    // would make the next load prioritize it over the untouched legacy copy.
    try {
      await deleteIndexedEnvelope()
    } catch (cleanupError) {
      log.warn('Failed to remove an unverified migrated studio envelope', { error: cleanupError })
    }
    preserveMigrationRollback(raw)
    preferLegacy = true
    setStatus(
      'legacy-fallback',
      error instanceof Error ? error.message : 'legacy migration failed',
    )
    return null
  }
}

/**
 * Canonical Zustand storage adapter.
 *
 * `getItem` is async; zustand's persist middleware supports promise-returning
 * storage. `setItem` deliberately catches and reports failures instead of
 * rejecting an unobserved promise: IndexedDB transactions are atomic, so the
 * previous record remains the last good corpus and is never overwritten by a
 * partial write.
 */
export const canonicalStudioStorage: PersistStorage<unknown> = {
  getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
    if (name !== STUDIO_STORAGE_KEY) return null
    // Server rendering has no browser storage. Returning null keeps the seed
    // state for SSR without logging a false storage failure on every request.
    if (typeof window === 'undefined' && typeof indexedDB === 'undefined') return null
    const legacyRaw = readLegacyRaw()
    const metadata = readMetadata()

    try {
      const indexed = await readIndexedEnvelope()
      if (indexed !== null) {
        cache(indexed, null)
        setStatus('indexeddb')
        return indexed
      }
    } catch (error) {
      // A previous canonical store means unreadable IDB data is a fail-closed
      // condition, not a fresh install. Let zustand surface the read failure so
      // the store blocks writes and the UI reports the refusal.
      if (metadata !== null) throw error
      preferLegacy = true
      log.warn('IndexedDB is unavailable; using the legacy studio store', { error })
    }

    if (legacyRaw !== null) {
      const migrated = await migrateLegacyEnvelope(legacyRaw)
      if (migrated !== null) {
        cache(migrated, legacyRaw)
        return migrated
      }
      try {
        const parsed = parseLegacy(legacyRaw)
        cache(parsed, legacyRaw)
        setStatus('legacy-fallback', 'legacy envelope left in localStorage')
        return parsed
      } catch (error) {
        // Mirror createJSONStorage's behavior: unreadable bytes reject the
        // hydration chain, which the store records as a fail-closed refusal.
        cache(null, legacyRaw)
        throw error
      }
    }

    cache(null, null)
    setStatus(
      typeof indexedDB === 'undefined' ? 'legacy-fallback' : 'indexeddb',
      typeof indexedDB === 'undefined' ? 'IndexedDB unavailable; using localStorage' : null,
    )
    return null
  },

  setItem: async (_name: string, value: StorageValue<unknown>): Promise<void> => {
    if (isSyncBlocked()) {
      log.warn(
        'Studio is not saving: your stored library could not be loaded, so the ' +
          'temporary workspace is left in memory only.',
      )
      return
    }

    const legacy = legacyStorage()
    const legacyRaw = JSON.stringify(value)

    if (typeof indexedDB !== 'undefined' && !preferLegacy) {
      try {
        await writeIndexedEnvelope(value)
        writeMetadata(value)
        removeLegacyAfterVerifiedWrite()
        cache(value, legacyRaw)
        setStatus('indexeddb')
        return
      } catch (error) {
        log.error('Failed to write the canonical studio envelope to IndexedDB', { error })
        preferLegacy = true
        setStatus('write-failed', error instanceof Error ? error.message : 'IndexedDB write failed')
        // Do not fall through to localStorage when IndexedDB was the canonical
        // store: the old IDB record is still the last good corpus, and a
        // localStorage copy would silently win on a later fallback read.
        return
      }
    }

    try {
      if (legacy !== null) {
        legacy.setItem(STUDIO_STORAGE_KEY, legacyRaw)
      }
      cache(value, legacyRaw)
      setStatus('legacy-fallback')
    } catch (error) {
      log.error('Failed to write the legacy studio envelope', { error })
      setStatus('write-failed', error instanceof Error ? error.message : 'localStorage write failed')
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (name !== STUDIO_STORAGE_KEY) return
    try {
      await deleteIndexedEnvelope()
    } catch (error) {
      log.warn('Failed to remove the canonical studio envelope', { error })
    }
    const storage = getLocalStorage()
    try {
      storage?.removeItem(STUDIO_STORAGE_KEY)
      storage?.removeItem(CANONICAL_META_KEY)
    } catch (error) {
      log.warn('Failed to remove legacy studio storage keys', { error })
    }
    cache(null, null)
    setStatus('indexeddb')
  },
}

/** Last-read canonical envelope bytes, for quarantine without a second read. */
export const getCanonicalRawEnvelope = (): string | null => cachedRaw

/** Whether hydration read a canonical or legacy envelope for this page. */
export const hasCanonicalStoredEnvelope = (): boolean => hasCachedEnvelope

/** Read the canonical envelope directly (tests and diagnostics). */
export const readCanonicalEnvelope = async (): Promise<StorageValue<unknown> | null> => {
  try {
    return await readIndexedEnvelope()
  } catch (error) {
    log.warn('Failed to read the canonical envelope directly', { error })
    return null
  }
}

/** Delete the canonical database and clear adapter state (tests only). */
export const resetCanonicalStorageForTests = async (): Promise<void> => {
  await deleteCanonicalDatabase()
  cachedRaw = null
  hasCachedEnvelope = false
  preferLegacy = false
  setStatus('unavailable')
}
