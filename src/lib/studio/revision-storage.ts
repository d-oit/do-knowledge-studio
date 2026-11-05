/**
 * IndexedDB storage for per-entity revisions (#1060).
 *
 * Revisions live in their own object store inside the canonical database, so
 * the canonical envelope stays the single source of the current corpus and a
 * corpus write never serializes history. Every read validates the record with
 * `EntityRevisionSchema`: the store is external input at the boundary, and a
 * record written by an older or newer build must not reach the UI unvalidated.
 */
import {
  REVISION_CREATED_INDEX,
  REVISION_ENTITY_INDEX,
  REVISIONS_OBJECT_STORE,
  openCanonicalDatabase,
} from './canonical-storage-idb'
import { EntityRevisionSchema, type EntityRevision } from './revision-model'

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

/** Newest first; the panel and retention both read in that order. */
const newestFirst = (a: EntityRevision, b: EntityRevision): number => {
  const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
}

/** Parses a stored record, returning null for anything malformed. */
const parseRevision = (value: unknown): EntityRevision | null => {
  const parsed = EntityRevisionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Revisions for one entity, newest first.
 * Malformed records are skipped rather than failing the whole list, so one bad
 * write cannot make an entity's history unreadable.
 */
export const listEntityRevisions = async (entityId: string): Promise<EntityRevision[]> => {
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<EntityRevision[]>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readonly')
  const request = transaction
    .objectStore(REVISIONS_OBJECT_STORE)
    .index(REVISION_ENTITY_INDEX)
    .getAll(entityId)
  request.onsuccess = () => {
    const records: unknown[] = Array.isArray(request.result) ? request.result : []
    const revisions: EntityRevision[] = []
    for (const record of records) {
      const revision = parseRevision(record)
      if (revision !== null) revisions.push(revision)
    }
    resolve(revisions.sort(newestFirst))
  }
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  return promise
}

/** Stores one revision. Missing/malformed records throw: callers log and skip. */
export const appendEntityRevision = async (revision: EntityRevision): Promise<void> => {
  const parsed = EntityRevisionSchema.parse(revision)
  const db = await openCanonicalDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readwrite')
  transaction.oncomplete = () => resolve()
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  transaction.objectStore(REVISIONS_OBJECT_STORE).put(parsed)
  return promise
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

/** Count and bytes currently stored, read with a cursor over the whole store. */
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
  const { promise, resolve, reject } = Promise.withResolvers<RevisionSummary[]>()
  const transaction = db.transaction(REVISIONS_OBJECT_STORE, 'readonly')
  const request = transaction.objectStore(REVISIONS_OBJECT_STORE).index(REVISION_CREATED_INDEX).openCursor()
  const summaries: RevisionSummary[] = []
  request.onsuccess = () => {
    const cursor = request.result
    if (cursor === null) {
      resolve(summaries)
      return
    }
    const revision = parseRevision(cursor.value)
    if (revision !== null) {
      summaries.push({
        id: revision.id,
        entityId: revision.entityId,
        createdAt: revision.createdAt,
        bytes: revision.bytes,
      })
    }
    cursor.continue()
  }
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  return promise
}

/** Removes every revision of one entity (tests and explicit user reset). */
export const clearEntityRevisions = async (entityId: string): Promise<void> => {
  const revisions = await listEntityRevisions(entityId)
  await deleteRevisions(revisions.map((revision) => revision.id))
}
