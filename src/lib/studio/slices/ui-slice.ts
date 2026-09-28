/**
 * Navigation, library controls, and panel visibility (Plan 157 Phase 3).
 *
 * Pure presentation state — none of it is undoable, and none of it is
 * persisted (see `partializePersistedState`, which drops the ephemeral keys
 * so typing never serializes the corpus).
 */
import type { ViewId, AnyEntityType } from '../types'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the navigation, controls, and panel slice. */
export type UiSlice = Pick<
  StudioState,
  | 'setView'
  | 'commandOpen'
  | 'setCommandOpen'
  | 'selectedEntityId'
  | 'editingEntityId'
  | 'searchQuery'
  | 'setSearchQuery'
  | 'typeFilter'
  | 'setTypeFilter'
  | 'semanticSearchEnabled'
  | 'setSemanticSearchEnabled'
  | 'sortBy'
  | 'setSortBy'
  | 'sortDir'
  | 'setSortDir'
  | 'rightPanelOpen'
  | 'setRightPanelOpen'
  | 'mobileDrawerOpen'
  | 'setMobileDrawerOpen'
  | 'mobilePanelView'
  | 'setMobilePanelView'
>

/** Library-control and panel defaults owned by this slice. */
const LIBRARY_CONTROL_DEFAULTS = {
  searchQuery: '',
  typeFilter: 'all',
  semanticSearchEnabled: false,
  sortBy: 'updated',
  sortDir: 'desc',
  rightPanelOpen: true,
} as const satisfies Pick<
  StudioState,
  'searchQuery' | 'typeFilter' | 'semanticSearchEnabled' | 'sortBy' | 'sortDir' | 'rightPanelOpen'
>

/** Builds the navigation, controls, and panel slice of the studio store. */
export const createUiSlice: StudioSlice<UiSlice> = (set) => ({
  ...LIBRARY_CONTROL_DEFAULTS,

  setView: (v) => set({ currentView: v }),

  commandOpen: false,
  setCommandOpen: (o) => set({ commandOpen: o }),

  selectedEntityId: null,
  editingEntityId: null,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setTypeFilter: (t) => set({ typeFilter: t }),
  setSemanticSearchEnabled: (enabled) => set({ semanticSearchEnabled: enabled }),
  setSortBy: (s) => set({ sortBy: s }),
  setSortDir: (d) => set({ sortDir: d }),

  setRightPanelOpen: (o) => set({ rightPanelOpen: o }),

  mobileDrawerOpen: false,
  setMobileDrawerOpen: (o) => set({ mobileDrawerOpen: o }),
  mobilePanelView: 'nav',
  setMobilePanelView: (v: 'nav' | 'search') => set({ mobilePanelView: v }),
})

/** Union of the entity type filter and the `all` sentinel. */
export type TypeFilter = AnyEntityType | 'all'

/** Re-exported so callers can type a view id without importing the store. */
export type { ViewId }
