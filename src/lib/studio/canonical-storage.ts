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
 *
 * At-rest encryption (ADR 048, issue #1162) sits on top of the same record: when
 * a session key is held, writes store an authenticated envelope and reads
 * decrypt it. Encryption enabled but locked is a distinct mode — reads return
 * null without hydrating, and writes are dropped rather than falling back to
 * plaintext. A wrong key, a tampered envelope, or an unsupported version throws,
 * which is what routes the refusal through the store's fail-closed path.
 */
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware'
import { STUDIO_STORAGE_KEY } from './hydration'
import { getGuardedStorage, isSyncBlocked } from './hydration-guard'
import {
  CANONICAL_DB_NAME,
  CANONICAL_OBJECT_STORE,
  CANONICAL_RECORD_KEY,
  deleteCanonicalDatabase,
  deleteIndexedEnvelope,
  readIndexedRawRecord,
  writeIndexedRawRecord,
} from './canonical-storage-idb'
import {
  AtRestWriteBlockedError,
  decodeCanonicalRecord,
  encodeCanonicalRecord,
  sameJson,
  verifyCanonicalRecord,
} from './canonical-storage-at-rest'
import {
  CANONICAL_META_FORMAT_VERSION,
  CANONICAL_META_KEY,
  getSafeLocalStorage,
  readMetadata,
  writeMetadata,
} from './canonical-storage-meta'
import {
  CANONICAL_MIGRATION_BACKUP_KEY,
  migrateLegacyEnvelope,
  parseLegacyEnvelope,
  removeLegacyAfterVerifiedWrite,
} from './canonical-storage-legacy'
import { isAtRestEnvelope } from './at-rest-crypto'
import { hasAtRestSessionKey, isAtRestEncryptionEnabled } from './at-rest-session'
import { quarantinePayload } from './hydration-quarantine'
import { logger } from '@/lib/logging/logger'

export { CANONICAL_DB_NAME, CANONICAL_OBJECT_STORE, CANONICAL_RECORD_KEY }
export { CANONICAL_META_KEY, CANONICAL_MIGRATION_BACKUP_KEY, CANONICAL_META_FORMAT_VERSION }
export type { CanonicalMetadata } from './canonical-storage-meta'

/** Subsystem tag for canonical-storage logs. */
const log = logger.child({ area: 'store' })

/** Where the current session's canonical writes are going. */
export type CanonicalStorageMode =
  | 'indexeddb'
  | 'legacy-fallback'
  | 'unavailable'
  | 'write-failed'
  | 'locked'

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
/**
 * Log the locked-workspace write refusal once per lock, not once per keystroke.
 * Reset when a write succeeds, which can only happen with a key installed.
 */
let lockedWriteWarned = false
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

/** Read the legacy Zustand envelope verbatim. */
const readLegacyRaw = (): string | null => {
  const storage = getSafeLocalStorage()
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

/**
 * Cache raw bytes for the synchronous quarantine path.
 *
 * A refused record has no value but DOES have bytes worth preserving — the
 * refusal path reads them back to quarantine them. Dropping `raw` whenever the
 * value is null would silently lose the only copy this page could offer.
 */
const cache = (value: StorageValue<unknown> | null, raw: string | null): void => {
  hasCachedEnvelope = value !== null
  cachedRaw = raw ?? (value === null ? null : JSON.stringify(value))
}

/** Run the legacy migration with this module's routing hooks. */
const runLegacyMigration = (raw: string): Promise<StorageValue<unknown> | null> =>
  migrateLegacyEnvelope(raw, {
    onStatus: (nextMode, reason = null) => setStatus(nextMode, reason),
    onLegacyFallback: () => {
      preferLegacy = true
    },
  })

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

    // Locked: the corpus exists but this session holds no key. Returning null
    // keeps the store on seed state WITHOUT latching a hydration refusal, so an
    // unlock later in the same page can rehydrate. Writes stay blocked by the
    // setItem guard below; nothing here may touch the encrypted record.
    const encrypted = isAtRestEncryptionEnabled()
    if (encrypted && !hasAtRestSessionKey()) {
      lockedWriteWarned = false
      cache(null, null)
      setStatus('locked', 'the encrypted workspace is locked')
      return null
    }

    // A legacy plaintext envelope is not even read while encryption is enabled:
    // hydrating it would bypass the setting, and the enable migration removes it
    // only after the encrypted record has been verified.
    const legacyRaw = encrypted ? null : readLegacyRaw()
    const metadata = readMetadata()

    let record: unknown = null
    try {
      record = await readIndexedRawRecord()
    } catch (error) {
      // A previous canonical store means unreadable IDB data is a fail-closed
      // condition, not a fresh install. Let zustand surface the read failure so
      // the store blocks writes and the UI reports the refusal.
      if (metadata !== null) throw error
      preferLegacy = true
      log.warn('IndexedDB is unavailable; using the legacy studio store', { error })
    }

    if (record !== null) {
      const outcome = await decodeCanonicalRecord(record)
      if (!outcome.ok) {
        // Cache the exact bytes (ciphertext when encrypted) for quarantine, then
        // fail closed: no plaintext fallback, no overwrite, no partial value.
        // Preserving the refusal here matters: the store's own refusal path runs
        // after this throws, and it needs a copy whose bytes are ciphertext, not
        // a decrypted corpus (ADR 048 §5).
        cache(null, outcome.quarantineRaw)
        if (outcome.quarantineRaw !== null) {
          quarantinePayload(outcome.message, outcome.quarantineRaw)
        }
        throw new Error(outcome.message)
      }
      cache(outcome.value, outcome.quarantineRaw)
      setStatus('indexeddb')
      return outcome.value
    }

    if (encrypted) {
      // A genuinely empty encrypted workspace: no record to decrypt. Not a
      // refusal (there is nothing to protect) and never a plaintext fallback.
      cache(null, null)
      setStatus('indexeddb')
      return null
    }

    if (legacyRaw !== null) {
      const migrated = await runLegacyMigration(legacyRaw)
      if (migrated !== null) {
        cache(migrated, legacyRaw)
        return migrated
      }
      try {
        const parsed = parseLegacyEnvelope(legacyRaw)
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

    const encrypted = isAtRestEncryptionEnabled()
    if (encrypted && !hasAtRestSessionKey()) {
      if (!lockedWriteWarned) {
        log.warn(
          'Studio is not saving: the encrypted workspace is locked, so this ' +
            'session holds no key. Unlock it to save changes; the encrypted ' +
            'library on disk is untouched.',
        )
        lockedWriteWarned = true
      }
      setStatus('locked', 'the encrypted workspace is locked')
      return
    }

    const legacy = encrypted ? null : legacyStorage()
    const legacyRaw = JSON.stringify(value)

    if (typeof indexedDB !== 'undefined' && !preferLegacy) {
      try {
        const record = await encodeCanonicalRecord(value)
        await writeIndexedRawRecord(record)
        // Read back and verify BEFORE removing any plaintext copy. A migration
        // whose ciphertext cannot be decrypted is not a migration.
        const readBack = await readIndexedRawRecord()
        if (!(await verifyCanonicalRecord(value, readBack))) {
          throw new Error('IndexedDB read-back did not match the written record')
        }
        writeMetadata(value)
        removeLegacyAfterVerifiedWrite()
        cache(value, isAtRestEnvelope(record) ? JSON.stringify(record) : legacyRaw)
        lockedWriteWarned = false
        setStatus('indexeddb')
        return
      } catch (error) {
        if (error instanceof AtRestWriteBlockedError) {
          log.warn('Studio is not saving: the encrypted workspace is locked')
          setStatus('locked', error.message)
          return
        }
        log.error('Failed to write the canonical studio envelope to IndexedDB', { error })
        preferLegacy = true
        setStatus('write-failed', error instanceof Error ? error.message : 'IndexedDB write failed')
        // Do not fall through to localStorage when IndexedDB was the canonical
        // store: the old IDB record is still the last good corpus, and a
        // localStorage copy would silently win on a later fallback read. The
        // same holds for an encrypted workspace, where a plaintext fallback
        // would defeat the setting outright.
        return
      }
    }

    if (encrypted) {
      setStatus(
        'write-failed',
        'IndexedDB is unavailable, and an encrypted workspace will not fall back to plaintext',
      )
      return
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
    const storage = getSafeLocalStorage()
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

/** Read and decode the canonical envelope (tests, diagnostics, migrations). */
export const readCanonicalEnvelope = async (): Promise<StorageValue<unknown> | null> => {
  try {
    const record = await readIndexedRawRecord()
    if (record === null) return null
    const outcome = await decodeCanonicalRecord(record)
    if (!outcome.ok) {
      log.warn('Failed to read the canonical envelope directly', {
        reason: outcome.failure,
      })
      return null
    }
    return outcome.value
  } catch (error) {
    log.warn('Failed to read the canonical envelope directly', { error })
    return null
  }
}

/**
 * Writes a PLAINTEXT canonical record and verifies the read-back.
 *
 * Used only by the disable-encryption migration, which must land the readable
 * copy before clearing the flag, and by the enable rollback, which must put the
 * readable corpus back when encryption could not be verified. It deliberately
 * ignores the session key; no other caller may use it.
 */
export const writeCanonicalPlaintextRecord = async (
  value: StorageValue<unknown>,
): Promise<void> => {
  await writeIndexedRawRecord(value)
  const readBack = await readIndexedRawRecord()
  if (!sameJson(readBack, value)) {
    throw new Error('IndexedDB read-back did not match the plaintext record')
  }
}

/**
 * Removes the canonical record without touching metadata (migration rollback).
 *
 * A removed record is not a backup: callers hold the value in memory and write
 * it back before reporting a failure to the user.
 */
export const deleteCanonicalRecord = async (): Promise<void> => {
  await deleteIndexedEnvelope()
}

/** Delete the canonical database and clear adapter state (tests only). */
export const resetCanonicalStorageForTests = async (): Promise<void> => {
  await deleteCanonicalDatabase()
  cachedRaw = null
  hasCachedEnvelope = false
  preferLegacy = false
  lockedWriteWarned = false
  setStatus('unavailable')
}
