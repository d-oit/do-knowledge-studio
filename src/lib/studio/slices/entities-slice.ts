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
  | 'mergeEntities'
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

/**
 * Builds the merged survivor entity from two current entities (deterministic).
 * Survivor fields win; the loser's trimmed name and aliases are appended
 * when not already present. Alias equivalence uses the resolver's
 * normalization (`trim().toLowerCase()`, matching `resolveWikilinkTarget`),
 * while the RETAINED value keeps its exact stored spelling — the first
 * occurrence (survivor's, then loser's) wins and is preserved verbatim.
 * Claims, links, tags, and referential updates are handled by the caller's
 * setter patch.
 */
const buildMergedEntity = (survivor: Entity, loser: Entity): Entity => {
  const mergedAliases = [...(survivor.aliases ?? [])]
  const loserName = loser.name.trim()
  if (loserName !== '' && !mergedAliases.some((a) => a.trim().toLowerCase() === loserName.toLowerCase())) {
    mergedAliases.push(loserName)
  }
  for (const alias of loser.aliases ?? []) {
    if (!mergedAliases.some((a) => a.trim().toLowerCase() === alias.trim().toLowerCase())) {
      mergedAliases.push(alias)
    }
  }
  const mergedTags = [...survivor.tags]
  for (const tag of loser.tags) {
    if (!mergedTags.some((t) => t.toLowerCase() === tag.toLowerCase())) mergedTags.push(tag)
  }
  return {
    ...survivor,
    aliases: mergedAliases,
    tags: mergedTags,
    content: survivor.content !== '' ? survivor.content : loser.content,
    description: survivor.description !== '' ? survivor.description : loser.description,
    links: [
      ...survivor.links,
      ...loser.links.filter(
        (l) =>
          l.targetId !== survivor.id &&
          !survivor.links.some((s) => s.targetId === l.targetId && s.relation === l.relation),
      ),
    ].map((l) => (l.targetId === loser.id ? { ...l, targetId: survivor.id } : l)),
    updatedAt: new Date().toISOString(),
  }
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

  mergeEntities: (survivorId, loserId) => {
    if (survivorId === loserId) return false
    // All state-dependent merge calculation reads the LATEST state inside the
    // functional setter. Deriving `mergedEntity` from a `get()` snapshot taken
    // before `set` runs would silently overwrite any intervening edit to the
    // survivor or loser that landed between the two (#1158). The computed
    // outcome is stashed for the history push and revision capture that follow.
    // The explicitly typed holder carries the setter's result to the following
    // history/revision steps while the merge still reads the latest state.
    const outcomeContainer: { outcome: { merged: Entity; previous: Entity } | null } = { outcome: null }
    set((current) => {
      const survivor = current.entities.find((x) => x.id === survivorId)
      const loser = current.entities.find((x) => x.id === loserId)
      if (!survivor || !loser) return {}
      const mergedEntity = buildMergedEntity(survivor, loser)
      outcomeContainer.outcome = { merged: mergedEntity, previous: survivor }
      const canvas = removeCanvasRefs(
        { graph: current.graph, mindMap: current.mindMap, links: current.links },
        loserId,
      )
      return {
        entities: current.entities
          .filter((x) => x.id !== loserId)
          .map((e) => {
            if (e.id === survivorId) return mergedEntity
            return { ...e, links: e.links.map((l) => (l.targetId === loserId ? { ...l, targetId: survivorId } : l)) }
          }),
        claims: current.claims.map((c) => (c.entityId === loserId ? { ...c, entityId: survivorId } : c)),
        graph: canvas.graph,
        mindMap: canvas.mindMap,
        links: (canvas.links ?? []).map((l) =>
          l.sourceId === loserId || l.targetId === loserId
            ? { ...l, sourceId: l.sourceId === loserId ? survivorId : l.sourceId, targetId: l.targetId === loserId ? survivorId : l.targetId }
            : l,
        ),
        selectedEntityId: current.selectedEntityId === loserId ? survivorId : current.selectedEntityId,
      }
    })
    if (!outcomeContainer.outcome) return false
    get().pushHistory()
    recordEntityRevision({ entity: outcomeContainer.outcome.merged, previous: outcomeContainer.outcome.previous, reason: 'save' })
    return true
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
