/**
 * Studio store history types (Plan 157 Phase 3, closes D1.6/D1.22).
 *
 * Undo/redo used to snapshot entities only. A claim added or edited after the
 * last entity edit was therefore invisible to history: undoing an entity
 * deletion restored the entity but not its claims, and undoing an entity edit
 * silently reverted every claim written since. Widening the snapshot to carry
 * claims alongside entities makes one history step a complete, atomic view of
 * the corpus.
 */
import type { Claim, Entity } from './types'

/** One point-in-time state of the undoable corpus. */
export interface HistorySnapshot {
  /** Full entity list at this point in history. */
  entities: Entity[]
  /** Full claim list at this point in history, kept in lockstep with `entities`. */
  claims: Claim[]
}

/**
 * Snapshots the corpus into an independent history entry.
 *
 * The per-record spread is a SHALLOW copy, and that is sufficient here: the
 * store is immutable — every write goes through `set` with fresh arrays and
 * objects, and nothing mutates `entity.links` or `claim.editHistory` in
 * place. A nested array is therefore never written through the snapshot, so a
 * shallow copy cannot alias a later mutation. `structuredClone` would be
 * safe but costs a full corpus deep-copy on every keystroke-level commit.
 *
 * If the store ever gains an in-place mutation, this must become a deep copy
 * in the same change — an aliasing bug there would be silent.
 */
export const snapshotCorpus = (entities: Entity[], claims: Claim[]): HistorySnapshot => ({
  entities: entities.map((e) => ({ ...e })),
  claims: claims.map((c) => ({ ...c })),
})

/**
 * Narrows a selection/edit id to an id that still exists in the restored
 * corpus. Undo can bring back a state in which the previously selected or
 * edited entity is absent; leaving a dangling id would make the editor and
 * right panel render for an entity that no longer exists.
 */
export const resolveDanglingId = (
  id: string | null,
  entities: Entity[],
): string | null => (id !== null && entities.some((e) => e.id === id) ? id : null)

/**
 * Prunes claims whose owning entity is gone, and drops link targets that no
 * longer resolve. Undo/redo restore whole snapshots verbatim, so a snapshot
 * written before a rename or delete could otherwise reintroduce orphans.
 */
export const reconcileSnapshot = (snapshot: HistorySnapshot): HistorySnapshot => {
  const entityIds = new Set(snapshot.entities.map((e) => e.id))
  return {
    entities: snapshot.entities.map((entity) => ({
      ...entity,
      links: entity.links.filter((link) => entityIds.has(link.targetId)),
    })),
    claims: snapshot.claims.filter((claim) => entityIds.has(claim.entityId)),
  }
}
