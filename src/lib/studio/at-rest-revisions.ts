/**
 * At-rest migration for stored entity revisions (ADR 048, issue #1162).
 *
 * The canonical envelope and the revision store have to move together: leaving
 * a plaintext history behind while the current corpus is encrypted protects
 * nothing, because every earlier version of a note is still readable.
 *
 * Ordering, same as the canonical record:
 *   1. read every stored record;
 *   2. encrypt (or decrypt) and verify each result in memory — the exact bytes
 *      that will be written;
 *   3. replace them in ONE transaction, so no partial state exists;
 *   4. read back and verify; on any mismatch restore the originals from memory.
 *
 * The originals are held in memory for the whole operation, which is what makes
 * step 4 a rollback rather than a hope.
 */
import { EntityRevisionSchema, type EntityRevision } from './revision-model'
import {
  readAllRevisionRecords,
  writeRevisionRecords,
} from './canonical-storage-idb'
import {
  decryptAtRestWithKey,
  encryptAtRestWithKey,
  type AtRestEnvelope,
} from './at-rest-crypto'
import { getAtRestSessionKey, getAtRestSessionSalt } from './at-rest-session'
import { isEncryptedRevisionRecord, type EncryptedRevisionRecord } from './revision-storage'
import { sameJson } from './canonical-storage-at-rest'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for revision-migration logs. */
const log = logger.child({ area: 'store' })

/** Outcome of moving revision history between plaintext and ciphertext. */
export type RevisionMigrationOutcome =
  | { ok: true; migrated: number }
  | { ok: false; error: string }

/** Builds the on-disk wrapper for one encrypted revision. */
const toEncryptedRecord = (
  revision: EntityRevision,
  atRest: AtRestEnvelope,
): EncryptedRevisionRecord => ({
  id: revision.id,
  entityId: revision.entityId,
  createdAt: revision.createdAt,
  bytes: revision.bytes,
  atRest,
})

/** Reads a stored revision record from either shape. */
const decodeRecord = async (
  record: unknown,
  key: CryptoKey,
): Promise<EntityRevision | null> => {
  if (isEncryptedRevisionRecord(record)) {
    const outcome = await decryptAtRestWithKey(record.atRest, key)
    if (!outcome.ok) return null
    const parsed = EntityRevisionSchema.safeParse(outcome.value)
    return parsed.success ? parsed.data : null
  }
  const parsed = EntityRevisionSchema.safeParse(record)
  return parsed.success ? parsed.data : null
}

/**
 * Encrypts every plaintext revision.
 *
 * Malformed plaintext records are left untouched rather than deleted: they were
 * already unusable to the app, and deleting them mid-migration would destroy
 * the only copy of whatever they were.
 */
export const encryptStoredRevisions = async (): Promise<RevisionMigrationOutcome> => {
  const key = getAtRestSessionKey()
  if (key === null) return { ok: false, error: 'the encrypted workspace is locked' }
  const salt = getAtRestSessionSalt()
  if (salt === null) return { ok: false, error: 'the at-rest session key has no corpus salt' }

  let records: unknown[]
  try {
    records = await readAllRevisionRecords()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'revision read failed' }
  }
  const plaintext = records.filter((record) => !isEncryptedRevisionRecord(record))
  if (plaintext.length === 0) return { ok: true, migrated: 0 }

  const encrypted: EncryptedRevisionRecord[] = []
  for (const record of plaintext) {
    const revision = EntityRevisionSchema.safeParse(record)
    if (!revision.success) continue
    const atRest = await encryptAtRestWithKey(revision.data, key, salt)
    const checked = await decryptAtRestWithKey(atRest, key)
    if (!checked.ok || !sameJson(checked.value, revision.data)) {
      return { ok: false, error: 'a revision could not be verified after encryption' }
    }
    encrypted.push(toEncryptedRecord(revision.data, atRest))
  }
  if (encrypted.length === 0) return { ok: true, migrated: 0 }

  try {
    await writeRevisionRecords(encrypted)
    const readBack = await readAllRevisionRecords()
    for (const expected of encrypted) {
      const stored = readBack.find(
        (record) => isEncryptedRevisionRecord(record) && record.id === expected.id,
      )
      const decoded = stored === undefined ? null : await decodeRecord(stored, key)
      const original = plaintext.find(
        (record) => EntityRevisionSchema.safeParse(record).data?.id === expected.id,
      )
      const originalRevision = EntityRevisionSchema.safeParse(original)
      if (decoded === null || !originalRevision.success || !sameJson(decoded, originalRevision.data)) {
        await writeRevisionRecords(plaintext)
        return { ok: false, error: 'revision read-back verification failed; history restored' }
      }
    }
    return { ok: true, migrated: encrypted.length }
  } catch (error) {
    log.error('Failed to encrypt stored entity revisions', { error })
    try {
      await writeRevisionRecords(plaintext)
    } catch (restoreError) {
      log.error('Failed to restore plaintext revisions after a failed encryption', {
        error: restoreError,
      })
      return {
        ok: false,
        error: 'revision encryption failed and the plaintext history could not be restored',
      }
    }
    return { ok: false, error: error instanceof Error ? error.message : 'revision migration failed' }
  }
}

/**
 * Decrypts every stored revision, used by the disable-encryption migration.
 *
 * Refuses before writing anything if a single revision cannot be decrypted: a
 * half-decrypted store is worse than an encrypted one, and the caller keeps the
 * workspace encrypted on failure.
 */
export const decryptStoredRevisions = async (): Promise<RevisionMigrationOutcome> => {
  const key = getAtRestSessionKey()
  if (key === null) return { ok: false, error: 'the encrypted workspace is locked' }

  let records: unknown[]
  try {
    records = await readAllRevisionRecords()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'revision read failed' }
  }
  const encrypted = records.filter(isEncryptedRevisionRecord)
  if (encrypted.length === 0) return { ok: true, migrated: 0 }

  const decrypted: EntityRevision[] = []
  for (const record of encrypted) {
    const revision = await decodeRecord(record, key)
    if (revision === null) {
      return {
        ok: false,
        error: 'a stored revision could not be decrypted; the workspace stays encrypted',
      }
    }
    decrypted.push(revision)
  }

  try {
    await writeRevisionRecords(decrypted)
    const readBack = await readAllRevisionRecords()
    for (const revision of decrypted) {
      const stored = readBack.find(
        (record) => !isEncryptedRevisionRecord(record) && EntityRevisionSchema.safeParse(record).data?.id === revision.id,
      )
      if (stored === undefined || !sameJson(stored, revision)) {
        await writeRevisionRecords(encrypted)
        return { ok: false, error: 'revision read-back verification failed; history restored' }
      }
    }
    return { ok: true, migrated: decrypted.length }
  } catch (error) {
    log.error('Failed to decrypt stored entity revisions', { error })
    try {
      await writeRevisionRecords(encrypted)
    } catch (restoreError) {
      log.error('Failed to restore encrypted revisions after a failed decryption', {
        error: restoreError,
      })
      return {
        ok: false,
        error: 'revision decryption failed and the encrypted history could not be restored',
      }
    }
    return { ok: false, error: error instanceof Error ? error.message : 'revision migration failed' }
  }
}
