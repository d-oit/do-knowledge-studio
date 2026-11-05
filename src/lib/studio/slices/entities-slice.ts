/**
 * Entity CRUD slice (Plan 157 Phase 3).
 *
 * Every mutation writes the corpus first and pushes a history snapshot after,
 * so one undo step reverses the whole operation. Batch writes (`commitEntities`,
 * `deleteEntity`'s claim cascade) go through the same path so they never split
 * across two undo steps.
 */
import { removeCanvasRefs } from '../canvas-refs'
import { recordEntityRevision } from '../revision-capture'
import type { Entity } from '../types'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the entity CRUD slice. */
export type EntitiesSlice = Pick<
  StudioState,
  | 'selectEntity'
  | 'startEdit'
  | 'startNew'
  | 'clearPendingEntityName'
  | 'pendingEntityName'
  | 'saveEntity'
  | 'commitEntity'
  | 'commitEntities'
  | 'finishEditing'
  | 'navigateToView'
  | 'deleteEntity'
  | 'restoreEntityRevision'
>

/** Applies an upsert to the entity list, inserting new entities at the front. */
const upsertEntities = (current: Entity[], upserts: Entity[]): Entity[] => {
  const upsertById = new Map(upserts.map((e) => [e.id, e]))
  const existingIds = new Set(current.map((x) => x.id))
  // Two dedupe passes. `existingIds` stops a re-insert of something already in
  // the corpus; the running `inserted` set stops a batch that repeats the same
  // NEW id from inserting it twice. Without the second pass, commitEntities
  // with a repeated id produced [dup, dup] — a duplicate entity in the library
  // and an ambiguous deleteEntity target.
  const fresh: Entity[] = []
  const inserted = new Set<string>()
  for (const e of upserts) {
    if (existingIds.has(e.id) || inserted.has(e.id)) continue
    inserted.add(e.id)
    fresh.push(e)
  }
  const merged = current.map((x) => upsertById.get(x.id) ?? x)
  return [...fresh, ...merged]
}

/** Builds the entity slice of the studio store. */
export const createEntitiesSlice: StudioSlice<EntitiesSlice> = (set, get) => ({
  selectEntity: (id) => set({ selectedEntityId: id }),

  startEdit: (id) => {
    const entity = get().entities.find((x) => x.id === id)
    if (!entity) return
    set({ editingEntityId: id, currentView: 'editor' })
  },

  pendingEntityName: null,

  startNew: (name) => {
    /** The title pre-fill, or null when the caller supplied none. */
    const initialName = name?.trim()
    set({
      editingEntityId: null,
      selectedEntityId: null,
      currentView: 'editor',
      // Always written (never left over): a plain `startNew()` must clear a
      // pre-fill from an earlier create command, or the editor would open the
      // next blank draft titled after the previous one.
      pendingEntityName: initialName ? initialName : null,
    })
  },

  clearPendingEntityName: () => {
    set({ pendingEntityName: null })
  },

  saveEntity: (e) => {
    const previous = get().entities.find((entity) => entity.id === e.id) ?? null
    set((state) => ({
      entities: upsertEntities(state.entities, [e]),
      editingEntityId: null,
      currentView: 'library',
    }))
    get().pushHistory()
    recordEntityRevision({ entity: e, previous, reason: 'save' })
  },

  commitEntity: (e) => {
    const previous = get().entities.find((entity) => entity.id === e.id) ?? null
    set((state) => ({ entities: upsertEntities(state.entities, [e]) }))
    get().pushHistory()
    recordEntityRevision({ entity: e, previous, reason: 'save' })
  },

  commitEntities: (upserts) => {
    // Single history step for the whole batch: apply all upserts, then
    // push once so one undo/redo spans the entire commit.
    const previousById = new Map(get().entities.map((entity) => [entity.id, entity]))
    set((state) => ({ entities: upsertEntities(state.entities, upserts) }))
    get().pushHistory()
    // Capture is fire-and-forget and throttled per entity; a batch import or
    // backlink rewrite must not hold the save path on IndexedDB (#1060).
    for (const upsert of upserts) {
      recordEntityRevision({
        entity: upsert,
        previous: previousById.get(upsert.id) ?? null,
        reason: 'save',
      })
    }
  },

  restoreEntityRevision: (snapshot) => {
    const previous = get().entities.find((entity) => entity.id === snapshot.id) ?? null
    if (!previous) return
    // The restored content is written as the CURRENT version and pushed to
    // history, so one Undo returns to the state the user was reading. The
    // pre-restore version is kept as a revision first, so restoring is also
    // reversible from the revision list after a reload.
    recordEntityRevision({ entity: previous, previous: null, reason: 'restore' })
    const restored: Entity = {
      ...snapshot,
      id: previous.id,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({ entities: upsertEntities(state.entities, [restored]) }))
    get().pushHistory()
  },

  finishEditing: () => {
    set({ editingEntityId: null })
  },

  navigateToView: (v) => {
    set({ currentView: v })
  },

  deleteEntity: (id) => {
    set((state) => {
      const canvas = removeCanvasRefs(
        { graph: state.graph, mindMap: state.mindMap, links: state.links },
        id,
      )
      return {
        entities: state.entities
          .filter((x) => x.id !== id)
          .map((e) => ({
            ...e,
            links: e.links.filter((l) => l.targetId !== id),
          })),
        claims: state.claims.filter((c) => c.entityId !== id),
        graph: canvas.graph,
        mindMap: canvas.mindMap,
        links: canvas.links,
        selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
      }
    })
    get().pushHistory()
  },
})
