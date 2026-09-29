/**
 * Import, rollback, and reset slice (Plan 157 Phase 3).
 *
 * Import replaces the whole corpus, so it rebases the undo baseline onto the
 * newly imported data rather than leaving the pre-import corpus as the next
 * undo target. The rollback path snapshots the pre-import state (including
 * claims and the canvas fields) so a failed swap is fully reversible.
 */
import { buildRecoverySnapshot, persistRecoverySnapshot } from '../recovery-helpers'
import { buildSeedState } from '../seed-state'
import type { Entity, Claim } from '../types'
import type { ImportOptions, StudioState } from '../store-types'
import { abortChatSend, resetSearchCache } from './chat-slice'
import type { StudioSlice } from './slice-types'

/** Keys owned by the import/reset slice. */
export type DataSlice = Pick<StudioState, 'importData' | 'importWithRollback' | 'resetStore'>

/** Shared tail of every corpus replacement: new baseline, no selection. */
const corpusPatch = (entities: Entity[], claims: Claim[], options?: ImportOptions) => ({
  entities,
  claims,
  selectedEntityId: null,
  editingEntityId: null,
  currentView: 'library' as const,
  entityHistory: [{ entities, claims }],
  historyIndex: 0,
  graph: options?.graph,
  mindMap: options?.mindMap,
  links: options?.links,
  tags: options?.tags,
})

/** Full state written by `resetStore` and by the last-ditch rollback fallback. */
const seedPatch = () => {
  const seed = buildSeedState()
  return {
    ...seed,
    selectedEntityId: null,
    editingEntityId: null,
    entityHistory: [{ entities: seed.entities, claims: seed.claims }],
    historyIndex: 0,
  }
}

/** Builds the import/reset slice of the studio store. */
export const createDataSlice: StudioSlice<DataSlice> = (set, get) => ({
  importData: (entities, claims, options) => {
    // Cancel any pending chat retrieval so it can't answer from the
    // pre-import corpus, then drop the stale cached search index.
    abortChatSend(get, set)
    resetSearchCache()
    set(corpusPatch(entities, claims, options))
  },

  importWithRollback: (entities, claims, options) => {
    // Cancel any pending chat retrieval and drop the cached index before
    // swapping corpora; on rollback the restored snapshot references force
    // a clean rebuild on next search.
    abortChatSend(get, set)
    resetSearchCache()
    const preImport = get()
    const snapshot = buildRecoverySnapshot(preImport)
    persistRecoverySnapshot(snapshot)
    try {
      set(corpusPatch(entities, claims, options))
      return { success: true }
    } catch (err) {
      try {
        set({
          entities: snapshot.entities,
          claims: snapshot.claims,
          entityHistory: snapshot.entityHistory,
          historyIndex: snapshot.historyIndex,
          graph: snapshot.graph,
          mindMap: snapshot.mindMap,
          links: snapshot.links,
          tags: snapshot.tags,
          // A failed import cleared the view and selection; restoring only the
          // corpus left the user staring at an empty Library with nothing
          // selected. Put them back where they were.
          currentView: preImport.currentView,
          selectedEntityId: preImport.selectedEntityId,
          editingEntityId: preImport.editingEntityId,
        })
      } catch {
        // The last-ditch reset can itself throw when the underlying storage is
        // still failing. Swallow it rather than let it escape `importWithRollback`,
        // which would reject instead of returning { success: false } — a caller
        // awaiting this gets a stuck promise and no error to show.
        try {
          set(seedPatch())
        } catch (seedError) {
          console.error('Studio could not reset after a failed import:', seedError)
        }
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Import failed, state restored.',
      }
    }
  },

  resetStore: () => {
    // Returning to the seed workspace — release any large cached index and
    // drop any pending chat retrieval so it can't answer post-reset.
    abortChatSend(get, set)
    resetSearchCache()
    set(seedPatch())
  },
})
