/**
 * Full shape of the studio store state and actions (Plan 157 Phase 3).
 *
 * Extracted from `store.ts` so the slice creators in `./slices/` can type
 * against the composed store without importing the store itself — a static
 * cycle back into `store.ts` would leave the slice module's bindings in the
 * temporal dead zone whenever the slice is the entry module.
 */
import type { Claim, Entity, ViewId, ChatMessage, AnyEntityType } from './types'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import type { HistorySnapshot } from './history-snapshot'
import type { RecoveryPersistFailure } from './recovery-helpers'

/** Optional graph/mindmap metadata attached to an import operation. */
export interface ImportOptions {
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Full shape of the Zustand store state and actions. */
export interface StudioState {
  // Navigation
  currentView: ViewId
  setView: (v: ViewId) => void
  commandOpen: boolean
  setCommandOpen: (o: boolean) => void

  // Entities
  entities: Entity[]
  selectedEntityId: string | null
  editingEntityId: string | null
  selectEntity: (id: string | null) => void
  startEdit: (id: string) => void
  startNew: () => void
  saveEntity: (e: Entity) => void
  commitEntity: (e: Entity) => void
  /** Atomically commit several entities under a single history snapshot.
   * Use for reciprocal writes (a save plus its backlinks) so one Undo
   * restores the whole operation, not just the last write. */
  commitEntities: (entities: Entity[]) => void
  finishEditing: () => void
  navigateToView: (v: ViewId) => void
  deleteEntity: (id: string) => void

  // History (undo/redo). Each entry carries the entity AND claim corpus so a
  // single step restores a complete, consistent state (Plan 157, D1.6).
  entityHistory: HistorySnapshot[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Claims
  claims: Claim[]
  addClaim: (claim: Omit<Claim, 'id'>) => void
  /** Atomically add several claims under a single history snapshot. */
  addClaims: (claims: Omit<Claim, 'id'>[]) => void
  updateClaim: (id: string, updates: Partial<Omit<Claim, 'id' | 'entityId'>>) => void
  deleteClaim: (id: string) => void

  // Library controls
  searchQuery: string
  setSearchQuery: (q: string) => void
  typeFilter: AnyEntityType | 'all'
  setTypeFilter: (t: AnyEntityType | 'all') => void
  semanticSearchEnabled: boolean
  setSemanticSearchEnabled: (enabled: boolean) => void
  sortBy: 'name' | 'created' | 'updated'
  setSortBy: (s: 'name' | 'created' | 'updated') => void
  sortDir: 'asc' | 'desc'
  setSortDir: (d: 'asc' | 'desc') => void

  // Chat
  chat: ChatMessage[]
  chatLoading: boolean
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void

  // Right panel
  rightPanelOpen: boolean
  setRightPanelOpen: (o: boolean) => void

  // Mobile drawer (visible below lg)
  mobileDrawerOpen: boolean
  setMobileDrawerOpen: (o: boolean) => void
  mobilePanelView: 'nav' | 'search'
  setMobilePanelView: (v: 'nav' | 'search') => void

  // Import / reset
  importData: (entities: Entity[], claims: Claim[], options?: ImportOptions) => void
  importWithRollback: (entities: Entity[], claims: Claim[], options?: ImportOptions) => ImportOutcome
  resetStore: () => void

  // Graph, mind map, links, and tags
  graph: ValidatedGraph | undefined
  mindMap: ValidatedMindMap | undefined
  links: ValidatedLink[] | undefined
  tags: ValidatedTag[] | undefined

  // Theme handled by next-themes — store tracks UI side effects only
}

/**
 * Outcome of an import-with-rollback.
 *
 * `backupPersisted` is separate from `success` on purpose: the import can
 * succeed while leaving the user with no way back to the corpus it replaced.
 * Callers must not report a clean import when it is `false`.
 */
export type ImportOutcome =
  | { success: true; backupPersisted: boolean; backupFailure?: RecoveryPersistFailure }
  | { success: false; error: string }

