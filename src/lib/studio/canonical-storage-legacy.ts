/**
 * One-time migration of the legacy localStorage corpus into IndexedDB.
 *
 * Extracted from `canonical-storage.ts` so the adapter keeps to one job (routing
 * reads and writes) and the migration keeps its own ordering rules in one
 * reviewable place: parse, write, read back, compare, then — only then — remove
 * the plaintext key.
 *
 * This path is plaintext by definition: it moves a corpus that predates
 * encryption. An encrypted workspace never reaches it (ADR 048 §5), and the
 * enable migration removes these keys itself once the ciphertext is verified.
 */
import type { StorageValue } from 'zustand/middleware'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY } from './hydration'
import {
  deleteIndexedEnvelope,
  readIndexedRawRecord,
  writeIndexedRawRecord,
} from './canonical-storage-idb'
import { sameJson } from './canonical-storage-at-rest'
import { getSafeLocalStorage, writeMetadata } from './canonical-storage-meta'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for canonical-storage logs. */
const log = logger.child({ area: 'store' })

/** One-time rollback copy of a legacy envelope whose migration failed. */
export const CANONICAL_MIGRATION_BACKUP_KEY = 'do-knowledge-studio-store-pre-indexeddb'

/** Hooks the adapter supplies so this module owns no routing state. */
export interface LegacyMigrationDeps {
  /** Reports where the adapter's writes are going. */
  onStatus: (mode: 'indexeddb' | 'legacy-fallback', reason?: string | null) => void
  /** Sticks the adapter to the legacy key for the rest of the page. */
  onLegacyFallback: () => void
}

/** Parse a legacy envelope without letting a malformed payload escape. */
export const parseLegacyEnvelope = (raw: string): StorageValue<unknown> => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) {
    throw new Error('legacy envelope is not a { state, version } object')
  }
  return parsed as StorageValue<unknown>
}

/** Remove the legacy live key after a verified canonical write. */
export const removeLegacyAfterVerifiedWrite = (): void => {
  const storage = getSafeLocalStorage()
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
  const storage = getSafeLocalStorage()
  if (storage === null) return
  try {
    if (storage.getItem(CANONICAL_MIGRATION_BACKUP_KEY) === null) {
      storage.setItem(CANONICAL_MIGRATION_BACKUP_KEY, raw)
    }
  } catch (error) {
    log.warn('Failed to preserve the pre-migration studio envelope', { error })
  }
}

/**
 * Move a same-version legacy envelope into IndexedDB.
 *
 * Returns the parsed value on success and `null` when migration did not run or
 * failed. The caller decides whether to fall back to the legacy read; a failed
 * migration never removes or rewrites the legacy bytes.
 */
export const migrateLegacyEnvelope = async (
  raw: string,
  deps: LegacyMigrationDeps,
): Promise<StorageValue<unknown> | null> => {
  let parsed: StorageValue<unknown>
  try {
    parsed = parseLegacyEnvelope(raw)
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
    await writeIndexedRawRecord(parsed)
    const verified = await readIndexedRawRecord()
    if (!sameJson(verified, parsed)) {
      throw new Error('IndexedDB read-back did not match the legacy envelope')
    }
    writeMetadata(parsed)
    removeLegacyAfterVerifiedWrite()
    deps.onStatus('indexeddb')
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
    deps.onLegacyFallback()
    deps.onStatus(
      'legacy-fallback',
      error instanceof Error ? error.message : 'legacy migration failed',
    )
    return null
  }
}
