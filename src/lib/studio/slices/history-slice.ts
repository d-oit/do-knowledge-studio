/**
 * Undo/redo slice (Plan 157 Phase 3, closes D1.6/D1.22).
 *
 * Every mutating action applies its change first and pushes a snapshot of the
 * post-mutation corpus afterwards, so the stack holds full states that undo
 * and redo restore verbatim. Snapshots carry claims alongside entities: an
 * entity edit no longer discards the claim edits made since the previous step,
 * and undoing a delete restores the entity *and* its claims together.
 */
import { reconcileSnapshot, resolveDanglingId, snapshotCorpus } from '../history-snapshot'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the undo/redo slice. */
export type HistorySlice = Pick<StudioState, 'entityHistory' | 'historyIndex' | 'pushHistory' | 'undo' | 'redo'>

/** Maximum number of undo history snapshots retained in memory. */
export const MAX_HISTORY = 50

/**
 * Restores the corpus at `index` and drops selection/edit pointers whose
 * entity the restored state no longer contains (D1.22). Snapshots are
 * reconciled on the way in so a restored state can never reintroduce a claim
 * or link that points at an entity the snapshot itself does not contain.
 */
const restoreHistoryIndex = (
  state: StudioState,
  index: number,
): Partial<StudioState> => {
  const { entityHistory, selectedEntityId, editingEntityId } = state
  const target = entityHistory[index]
  if (!target) return {}
  const { entities, claims } = reconcileSnapshot(target)
  return {
    entities,
    claims,
    historyIndex: index,
    selectedEntityId: resolveDanglingId(selectedEntityId, entities),
    editingEntityId: resolveDanglingId(editingEntityId, entities),
  }
}

/** Builds the undo/redo slice of the studio store. */
export const createHistorySlice: StudioSlice<HistorySlice> = (set, get) => ({
  entityHistory: [],
  historyIndex: -1,

  pushHistory: () => {
    const { entities, claims, historyIndex, entityHistory } = get()
    const trimmed = entityHistory.slice(0, historyIndex + 1)
    const next = [...trimmed, snapshotCorpus(entities, claims)]
    if (next.length > MAX_HISTORY) next.shift()
    set({
      entityHistory: next,
      historyIndex: next.length - 1,
    })
  },

  undo: () => {
    const { historyIndex } = get()
    if (historyIndex <= 0) return
    set((state) => restoreHistoryIndex(state, historyIndex - 1))
  },

  redo: () => {
    const { entityHistory, historyIndex } = get()
    if (historyIndex >= entityHistory.length - 1) return
    set((state) => restoreHistoryIndex(state, historyIndex + 1))
  },
})
