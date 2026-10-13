/**
 * Studio store history types (Plan 157 Phase 3, closes D1.6/D1.22).
 *
 * Undo/redo used to snapshot entities only. A claim or canvas edit after the
 * last entity change was therefore invisible to history: undoing a deletion
 * restored the entity but not its claims or graph/link data, and undoing an
 * entity edit silently reverted every claim written since. Carrying claims
 * and canvas with entities makes one history step a complete corpus view.
 */
import type { CanvasSnapshot } from './canvas-refs'
import { pruneDanglingCanvasRefs } from './canvas-refs'
import type { Claim, Entity } from './types'

/** One point-in-time state of the undoable corpus. */
export interface HistorySnapshot {
  /** Full entity list at this point in history. */
  entities: Entity[]
  /** Full claim list at this point in history, kept in lockstep with `entities`. */
  claims: Claim[]
  /** Canvas payload, shared by reference because store writes replace its arrays. */
  canvas?: CanvasSnapshot
}

/**
 * Snapshots the corpus into an independent history entry.
 *
 * The per-record spread is a SHALLOW copy, and that is sufficient here: the
 * store is immutable — every write goes through `set` with fresh arrays and
 * objects, and nothing mutates `entity.links` or `claim.editHistory` in
 * place. Canvas is also stored by reference: canvas writes replace their
 * arrays and objects rather than mutating them. A nested array is therefore
 * never written through the snapshot, so a shallow copy cannot alias a later
 * mutation. `structuredClone` would copy the canvas for every history step
 * and costs a full corpus deep-copy on every keystroke-level commit.
 *
 * If the store ever gains an in-place mutation, this must become a deep copy
 * in the same change — an aliasing bug there would be silent.
 */
export const snapshotCorpus = (
  entities: Entity[],
  claims: Claim[],
  canvas: CanvasSnapshot,
): HistorySnapshot => ({
  entities: entities.map((e) => ({ ...e })),
  claims: claims.map((c) => ({ ...c })),
  canvas,
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
 * Prunes claims, entity links, and canvas edges/links whose entity references
 * do not resolve within this snapshot, so undo/redo cannot reintroduce orphans.
 */
export const reconcileSnapshot = (snapshot: HistorySnapshot): HistorySnapshot => {
  const entityIds = new Set(snapshot.entities.map((e) => e.id))
  return {
    entities: snapshot.entities.map((entity) => ({
      ...entity,
      links: entity.links.filter((link) => entityIds.has(link.targetId)),
    })),
    claims: snapshot.claims.filter((claim) => entityIds.has(claim.entityId)),
    ...(snapshot.canvas
      ? { canvas: pruneDanglingCanvasRefs(snapshot.canvas, entityIds) }
      : {}),
  }
}
