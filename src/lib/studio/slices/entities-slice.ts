/**
 * Entity CRUD slice (Plan 157 Phase 3).
 *
 * Every mutation writes the corpus first and pushes a history snapshot after,
 * so one undo step reverses the whole operation. Batch writes (`commitEntities`,
 * `deleteEntity`'s claim cascade) go through the same path so they never split
 * across two undo steps.
 */
import type { Entity } from '../types'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the entity CRUD slice. */
export type EntitiesSlice = Pick<
  StudioState,
  | 'selectEntity'
  | 'startEdit'
  | 'startNew'
  | 'saveEntity'
  | 'commitEntity'
  | 'commitEntities'
  | 'finishEditing'
  | 'navigateToView'
  | 'deleteEntity'
>

/** Applies an upsert to the entity list, inserting new entities at the front. */
const upsertEntities = (current: Entity[], upserts: Entity[]): Entity[] => {
  const upsertById = new Map(upserts.map((e) => [e.id, e]))
  const existingIds = new Set(current.map((x) => x.id))
  const fresh = upserts.filter((e) => !existingIds.has(e.id))
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

  startNew: () => {
    set({
      editingEntityId: null,
      selectedEntityId: null,
      currentView: 'editor',
    })
  },

  saveEntity: (e) => {
    set((state) => ({
      entities: upsertEntities(state.entities, [e]),
      editingEntityId: null,
      currentView: 'library',
    }))
    get().pushHistory()
  },

  commitEntity: (e) => {
    set((state) => ({ entities: upsertEntities(state.entities, [e]) }))
    get().pushHistory()
  },

  commitEntities: (upserts) => {
    // Single history step for the whole batch: apply all upserts, then
    // push once so one undo/redo spans the entire commit.
    set((state) => ({ entities: upsertEntities(state.entities, upserts) }))
    get().pushHistory()
  },

  finishEditing: () => {
    set({ editingEntityId: null })
  },

  navigateToView: (v) => {
    set({ currentView: v })
  },

  deleteEntity: (id) => {
    set((state) => ({
      entities: state.entities
        .filter((x) => x.id !== id)
        .map((e) => ({
          ...e,
          links: e.links.filter((l) => l.targetId !== id),
        })),
      claims: state.claims.filter((c) => c.entityId !== id),
      selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
    }))
    get().pushHistory()
  },
})
