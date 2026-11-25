/**
 * IndexedDB storage for per-entity revisions (#1060).
 *
 * Revisions live in their own object store inside the canonical database, so
 * the canonical envelope stays the single source of the current corpus and a
 * corpus write never serializes history. Every read validates the record with
 * `EntityRevisionSchema`: the store is external input at the boundary, and a
 * record written by an older or newer build must not reach the UI unvalidated.
 *
 * At-rest encryption (ADR 048, issue #1162): when a session key is held, a
 * revision body is stored as an authenticated envelope inside the record, while
 * `id`, `entityId`, `createdAt` and `bytes` stay in the clear because the two
 * indexes and byte eviction are built on them. Those four fields reveal that a
 * revision exists and when — never what it says. With encryption enabled but
 * locked, plaintext records are invisible and writes are refused.
 */
import {
  REVISION_CREATED_INDEX,
  REVISION_ENTITY_INDEX,
  REVISIONS_OBJECT_STORE,
  openCanonicalDatabase,
} from './canonical-storage-idb'
import { EntityRevisionSchema, type EntityRevision } from './revision-model'
import { decryptAtRestWithKey, encryptAtRestWithKey, type AtRestEnvelope } from './at-rest-crypto'
import {
  getAtRestSessionKey,
  getAtRestSessionSalt,
  isAtRestEncryptionEnabled,
} from './at-rest-session'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for revision-storage logs. */
const log = logger.child({ area: 'store' })

/** Count and serialized bytes held by the revision store. */
export interface RevisionUsage {
  count: number
  bytes: number
}

/** The fields eviction needs, without loading every snapshot body. */
export interface RevisionSummary {
  id: string
  entityId: string
  createdAt: string
  bytes: number
}

/** On-disk shape of an encrypted revision: indexable metadata + ciphertext. */
export interface EncryptedRevisionRecord extends RevisionSummary {
  atRest: AtRestEnvelope
}

/** Newest first; the panel and retention both read in that order. */
const newestFirst = (a: EntityRevision, b: EntityRevision): number => {
  const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
}

/** Narrows an unknown record to the encrypted revision shape. */
export const isEncryptedRevisionRecord = (value: unknown): value is EncryptedRevisionRecord => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<EncryptedRevisionRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.entityId === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.bytes === 'number' &&
    typeof record.atRest === 'object' &&
    record.atRest !== null
  )
}

/** Parses a plaintext stored record, returning null for anything malformed. */
const parseRevision = (value: unknown): EntityRevision | null => {
  const parsed = EntityRevisionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Decrypts and validates one stored record.
 *
 * A plaintext record while encryption is enabled is refused rather than
 * returned: showing it would quietly defeat the setting. A record whose
 * envelope cannot be decrypted is skipped with a warning — one damaged revision
 * must not make the whole history unreadable, and it is never deleted here.
 */
const readRevisionRecord = async (value: unknown): Promise<EntityRevision | null> => {
  if (isEncryptedRevisionRecord(value)) {
    const key = getAtRestSessionKey()
    if (key === null) return null
    const outcome = await decryptAtRestWithKey(value.atRest, key)
    if (!outcome.ok) {
      log.warn('Stored entity revision could not be decrypted', { reason: outcome.reason })
      return null
    }
    return parseRevision(outcome.value)
  }
  if (isAtRestEncryptionEnabled()) return null
  return parseRevision(value)
}

/** Summary of one stored record; encrypted bodies are not decrypted. */
const summarizeRecord = (value: unknown): RevisionSummary | null => {
  if (isEncryptedRevisionRecord(value)) {
    const { id, entityId, createdAt, bytes } = value
    return { id, entityId, createdAt, bytes }
  }
  if (isAtRestEncryptionEnabled()) return null
  const revision = parseRevision(value)
  if (revision === null) return null
  return {
    id: revision.id,
    entityId: revision.entityId,
    createdAt: revision.createdAt,
    bytes: revision.bytes,
  }
}

/**
 * Revisions for one entity, newest first.
 * Malformed, undecryptable or plaintext-while-encrypted records are skipped
 * rather than failing the whole list, so one bad write cannot make an entity's
 * history unreadable.
 */
export const listEntityRevisions = async (entityId: string): Promise<EntityRevision[]> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<unknown[]>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readonly')
  const request = transaction
    .objectStore(REVISIONS_OBJECT_STORE)
    .index(REVISION_ENTITY_INDEX)
    .getAll(entityId)
  request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  const records = await promise

  const revisions: EntityRevision[] = []
  for (const record of records) {
    const revision = await readRevisionRecord(record)
    if (revision !== null) revisions.push(revision)
  }
  return revisions.sort(newestFirst)
}

/** Puts one record in its own transaction. */
const putRecord = async (record: unknown): Promise<void> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readwrite')
  transaction.oncomplete = () => resolve()
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  transaction.objectStore(REVISIONS_OBJECT_STORE).put(record)
  return promise
}

/**
 * Stores one revision. Missing/malformed records throw: callers log and skip.
 *
 * While encryption is enabled and locked this throws instead of writing
 * plaintext; the caller's `log and skip` is the correct outcome, and the
 * history stays at its last encrypted state.
 */
export const appendEntityRevision = async (revision: EntityRevision): Promise<void> => {
  const parsed = EntityRevisionSchema.parse(revision)
  const key = getAtRestSessionKey()
  if (key === null) {
    if (isAtRestEncryptionEnabled()) {
      throw new Error('the encrypted workspace is locked; revision history was not written')
    }
    await putRecord(parsed)
    return
  }
  const salt = getAtRestSessionSalt()
  if (salt === null) throw new Error('the at-rest session key has no corpus salt')
  const atRest = await encryptAtRestWithKey(parsed, key, salt)
  await putRecord({
    id: parsed.id,
    entityId: parsed.entityId,
    createdAt: parsed.createdAt,
    bytes: parsed.bytes,
    atRest,
  } satisfies EncryptedRevisionRecord)
}

/** Deletes revisions by id in one transaction. */
export const deleteRevisions = async (ids: readonly string[]): Promise<void> => {
  if (ids.length === 0) return
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readwrite')
  transaction.oncomplete = () => resolve()
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  const store = transaction.objectStore(REVISIONS_OBJECT_STORE)
  for (const id of ids) store.delete(id)
  return promise
}

/** Count and bytes currently stored, from record metadata only. */
export const readRevisionUsage = async (): Promise<RevisionUsage> => {
  const summaries = await listRevisionSummaries()
  return summaries.reduce(
    (usage, summary) => ({ count: usage.count + 1, bytes: usage.bytes + summary.bytes }),
    { count: 0, bytes: 0 },
  )
}

/**
 * Every stored revision's metadata, oldest first — the order global byte
 * eviction deletes in.
 */
export const listRevisionSummaries = async (): Promise<RevisionSummary[]> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<unknown[]>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readonly')
  const request = transaction
    .objectStore(REVISIONS_OBJECT_STORE)
    .index(REVISION_CREATED_INDEX)
    .getAll()
  request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  const records = await promise

  const summaries: RevisionSummary[] = []
  for (const record of records) {
    const summary = summarizeRecord(record)
    if (summary !== null) summaries.push(summary)
  }
  return summaries
}

/** Removes every revision of one entity (tests and explicit user reset). */
export const clearEntityRevisions = async (entityId: string): Promise<void> => {
  const revisions = await listEntityRevisions(entityId)
  await deleteRevisions(revisions.map((revision) => revision.id))
}
