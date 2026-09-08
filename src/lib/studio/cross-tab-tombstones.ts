/**
 * Session-scoped deletion tombstones for cross-tab sync (ADR 028).
 *
 * BroadcastChannel messages carry per-change deletion lists, but the window
 * `storage` fallback path carries no tombstones: an absent id is
 * indistinguishable from one never seen, so a tab holding a deleted item
 * could resurrect it in the deleting tab via a stale snapshot. This registry
 * records every deletion observed (locally or remotely) so the storage path
 * applies the same drop/recreate arbitration as the broadcast path.
 */

/** Session-scoped map of deleted item id -> deletion time (ms epoch). */
const tombstones = new Map<string, number>()

/** Records a deletion at the given time, keeping the latest timestamp. */
export const recordDeletion = (id: string, timestamp: number): void => {
  const existing = tombstones.get(id)
  if (existing === undefined || timestamp > existing) {
    tombstones.set(id, timestamp)
  }
}

/** Records multiple deletions observed in one broadcast or local change. */
export const recordDeletions = (ids: readonly string[], timestamp: number): void => {
  for (const id of ids) {
    recordDeletion(id, timestamp)
  }
}

/** Returns the current tombstone map (id -> deletion time). */
export const getDeletions = (): ReadonlyMap<string, number> => tombstones

/** Clears all tombstones. Used by tests to isolate between cases. */
export const resetDeletions = (): void => {
  tombstones.clear()
}