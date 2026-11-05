/**
 * Saved graph views (#1058).
 *
 * Views are durable user data, so they live in the store envelope next to the
 * corpus rather than in a second localStorage corpus: persistence, validation,
 * cross-tab coordination, and backup restore all flow through the paths the
 * library already uses. Saving is not undoable — the undo history covers the
 * corpus, not canvas bookmarks.
 */
import { removeSavedGraphView, upsertSavedGraphView, type SavedGraphView } from '../graph-views'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the saved-views slice. */
export type GraphViewsSlice = Pick<
  StudioState,
  'graphViews' | 'saveGraphView' | 'deleteGraphView'
>

/** Builds the saved-views slice of the studio store. */
export const createGraphViewsSlice: StudioSlice<GraphViewsSlice> = (set) => ({
  graphViews: [],

  saveGraphView: (view: SavedGraphView) => {
    set((state) => ({ graphViews: upsertSavedGraphView(state.graphViews, view) }))
  },

  deleteGraphView: (id: string) => {
    set((state) => ({ graphViews: removeSavedGraphView(state.graphViews, id) }))
  },
})
