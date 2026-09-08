/**
 * Session-scoped deletion tombstones for cross-tab sync (ADR 028).
 *
 * BroadcastChannel messages carry per-change deletion lists, but the window
 * `storage` fallback path carries no tombstones: an absent id is
 * indistinguishable from one never seen, so a tab holding a deleted item
 * could resurrect it in the deleting tab via a stale snapshot. This registry
 * records every deletion observed (locally or remotely) so every merge path
 * applies the same drop/recreate arbitration as the broadcast path.
 *
 * Entity and claim ids live in separate namespaces, so they are tracked in
 * two maps keyed by bare id.
 */

/** Which record namespace a tombstone belongs to. */
export type TombstoneKind = 'entity' | 'claim'

/** Session-scoped map of deleted entity id -> deletion time (ms epoch). */
const entityTombstones = new Map<string, number>()

/** Session-scoped map of deleted claim id -> deletion time (ms epoch). */
const claimTombstones = new Map<string, number>()

const tables: Record<TombstoneKind, Map<string, number>> = {
  entity: entityTombstones,
  claim: claimTombstones,
}

/** Records a deletion at the given time, keeping the latest timestamp. */
export const recordDeletion = (kind: TombstoneKind, id: string, timestamp: number): void => {
  const table = tables[kind]
  const existing = table.get(id)
  if (existing === undefined || timestamp > existing) {
    table.set(id, timestamp)
  }
}

/** Records a batch of deletions of one kind at the given time. */
export const recordDeletions = (kind: TombstoneKind, ids: readonly string[], timestamp: number): void => {
  for (const id of ids) {
    recordDeletion(kind, id, timestamp)
  }
}

/** Returns the tombstone map for one kind (id -> deletion time). */
export const getDeletions = (kind: TombstoneKind): ReadonlyMap<string, number> => tables[kind]

/** Clears all tombstones. Called on sync teardown and by tests. */
export const resetDeletions = (): void => {
  entityTombstones.clear()
  claimTombstones.clear()
}