'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Entity, Claim, ViewId, ChatMessage, EntityType } from './types'
import { seedEntities, seedClaims, seedChat } from './seed-data'
import { resetSearchCache } from '@/lib/search/retrieval'
import { searchAsync } from '@/lib/search/search-worker-client'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import {
  CURRENT_SCHEMA_VERSION,
  STUDIO_STORAGE_KEY,
  mergeHydratedState,
  migratePersistedState,
  partializePersistedState,
} from './hydration'
import { buildRecoverySnapshot, persistRecoverySnapshot } from './recovery-helpers'
export { restoreFromRecovery } from './recovery-helpers'

/** Maximum number of undo history snapshots retained in memory. */
const MAX_HISTORY = 50

/** Abort controller for the in-flight local-chat retrieval (see {@link StudioState.sendMessage}). */
let chatSendAbort: AbortController | null = null

/** Optional graph/mindmap metadata attached to an import operation. */
interface ImportOptions {
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Full shape of the Zustand store state and actions. */
interface StudioState {
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
  finishEditing: () => void
  navigateToView: (v: ViewId) => void
  deleteEntity: (id: string) => void

  // History (undo/redo)
  entityHistory: Entity[][]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Claims
  claims: Claim[]
  addClaim: (claim: Omit<Claim, 'id'>) => void
  updateClaim: (id: string, updates: Partial<Omit<Claim, 'id' | 'entityId'>>) => void
  deleteClaim: (id: string) => void

  // Library controls
  searchQuery: string
  setSearchQuery: (q: string) => void
  typeFilter: EntityType | 'all'
  setTypeFilter: (t: EntityType | 'all') => void
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
  importWithRollback: (entities: Entity[], claims: Claim[], options?: ImportOptions) => { success: boolean; error?: string }
  resetStore: () => void

  // Graph, mind map, links, and tags
  graph: ValidatedGraph | undefined
  mindMap: ValidatedMindMap | undefined
  links: ValidatedLink[] | undefined
  tags: ValidatedTag[] | undefined

  // Theme handled by next-themes — store tracks UI side effects only
}

/** Generates a new UUID for entities, claims, and chat messages. */
const generateId = (): string => crypto.randomUUID()

// The default (seed) state — used on first load and as a fallback when a
// persisted state is missing fields. Kept here so both the store initializer
// and `resetStore` reference the same defaults.
/** Default seed state used on first load and as the reset baseline. */
const SEED_STATE = {
  entities: seedEntities,
  claims: seedClaims,
  chat: seedChat,
  chatLoading: false,
  currentView: 'home' as ViewId,
  searchQuery: '',
  typeFilter: 'all' as EntityType | 'all',
  sortBy: 'updated' as 'name' | 'created' | 'updated',
  sortDir: 'desc' as 'asc' | 'desc',
  rightPanelOpen: true,
  graph: undefined as ValidatedGraph | undefined,
  mindMap: undefined as ValidatedMindMap | undefined,
  links: undefined as ValidatedLink[] | undefined,
  tags: undefined as ValidatedTag[] | undefined,
}

/** Primary Zustand store for the knowledge studio with persistence and undo/redo. */
export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      ...SEED_STATE,

      entityHistory: [seedEntities],
      historyIndex: 0,

      setView: (v) => set({ currentView: v }),

      commandOpen: false,
      setCommandOpen: (o) => set({ commandOpen: o }),

      selectedEntityId: null,
      editingEntityId: null,

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

      pushHistory: () => {
        const { entities, historyIndex, entityHistory } = get()
        const snapshot = entities.map((e) => ({ ...e }))
        const trimmed = entityHistory.slice(0, historyIndex + 1)
        const next = [...trimmed, snapshot]
        if (next.length > MAX_HISTORY) next.shift()
        set({
          entityHistory: next,
          historyIndex: next.length - 1,
        })
      },

      undo: () => {
        const { entityHistory, historyIndex } = get()
        if (historyIndex <= 0) return
        const newIndex = historyIndex - 1
        const snapshot = entityHistory[newIndex].map((e) => ({ ...e }))
        set({ entities: snapshot, historyIndex: newIndex })
      },

      redo: () => {
        const { entityHistory, historyIndex } = get()
        if (historyIndex >= entityHistory.length - 1) return
        const newIndex = historyIndex + 1
        const snapshot = entityHistory[newIndex].map((e) => ({ ...e }))
        set({ entities: snapshot, historyIndex: newIndex })
      },
      saveEntity: (e) => {
        const { pushHistory } = get()
        pushHistory()
        set((state) => {
          const exists = state.entities.some((x) => x.id === e.id)
          const entities = exists
            ? state.entities.map((x) => (x.id === e.id ? e : x))
            : [e, ...state.entities]
          return {
            entities,
            editingEntityId: null,
            currentView: 'library',
          }
        })
      },

      commitEntity: (e) => {
        const { pushHistory } = get()
        pushHistory()
        set((state) => {
          const exists = state.entities.some((x) => x.id === e.id)
          const entities = exists
            ? state.entities.map((x) => (x.id === e.id ? e : x))
            : [e, ...state.entities]
          return { entities }
        })
      },

      finishEditing: () => {
        set({ editingEntityId: null })
      },

      navigateToView: (v: ViewId) => {
        set({ currentView: v })
      },

      deleteEntity: (id) => {
        const { pushHistory } = get()
        pushHistory()
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
      },

      addClaim: (claim) => {
        const now = new Date().toISOString()
        const fullClaim: Claim = {
          ...claim,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          version: 1,
          editHistory: [],
        }
        set((state) => ({ claims: [fullClaim, ...state.claims] }))
      },

      updateClaim: (id, updates) => {
        set((state) => ({
          claims: state.claims.map((claim) => {
            if (claim.id !== id) return claim
            const now = new Date().toISOString()
            const historyEntry = updates.statement && updates.statement !== claim.statement
              ? { statement: claim.statement, editedAt: claim.updatedAt ?? now }
              : null
            return {
              ...claim,
              ...updates,
              updatedAt: now,
              version: (claim.version ?? 1) + 1,
              editHistory: historyEntry
                ? [...(claim.editHistory ?? []), historyEntry]
                : claim.editHistory ?? [],
            }
          }),
        }))
      },

      deleteClaim: (id) => {
        set((state) => ({
          claims: state.claims.filter((claim) => claim.id !== id),
        }))
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setTypeFilter: (t) => set({ typeFilter: t }),
      setSortBy: (s) => set({ sortBy: s }),
      setSortDir: (d) => set({ sortDir: d }),

      sendMessage: (content) => {
        const userMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        }
        set((state) => ({ chat: [...state.chat, userMsg], chatLoading: true }))

        // Cancel any in-flight retrieval from a previous send so a newer message
        // never races a stale search result (AGENTS.md: AbortController for all
        // async work). The active controller owns state updates; stale ones are
        // dropped on abort.
        chatSendAbort?.abort()
        const controller = new AbortController()
        chatSendAbort = controller

        const { entities, claims } = get()
        return searchAsync(entities, claims, content, 5, controller.signal)
          .then((results) => {
            if (controller.signal.aborted) return
            const cited = results.map((r) => ({
              entityId: r.entityId ?? r.id,
              entityName: r.entityName ?? r.name,
              snippet: r.snippet,
            }))
            const reply: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: results.length
                ? `Based on ${results.length === 1 ? '1 match' : `${results.length} matches`} in your library, here is what I found. ${results[0].snippet} You can open the cited sources for full detail, or ask me to compare them.`
                : "I could not find a direct match in your local library. Try rephrasing with keywords that appear in your entity names or descriptions, or capture a new entity first via the Editor.",
              citations: cited,
              timestamp: new Date().toISOString(),
            }
            set((state) => ({ chat: [...state.chat, reply], chatLoading: false }))
          })
          .catch((err: unknown) => {
            // Stale (aborted) sends defer chatLoading ownership to the active
            // controller; only the active one should clear loading.
            if (chatSendAbort === controller) {
              set({ chatLoading: false })
            }
            if (err instanceof DOMException && err.name === 'AbortError') return
            console.error('Local chat search failed:', err)
          })
      },

      clearChat: () => set({ chat: [], chatLoading: false }),

      setRightPanelOpen: (o) => set({ rightPanelOpen: o }),

      mobileDrawerOpen: false,
      setMobileDrawerOpen: (o) => set({ mobileDrawerOpen: o }),
      mobilePanelView: 'nav',
      setMobilePanelView: (v) => set({ mobilePanelView: v }),

      importData: (entities, claims, options) => {
        // A new corpus means the cached search index is stale — drop it so
        // the previous dataset's memory is released immediately.
        resetSearchCache()
        set({
          entities,
          claims,
          selectedEntityId: null,
          editingEntityId: null,
          currentView: 'library',
          entityHistory: [entities],
          historyIndex: 0,
          graph: options?.graph,
          mindMap: options?.mindMap,
          links: options?.links,
          tags: options?.tags,
        })
      },

      importWithRollback: (entities, claims, options) => {
        // Drop the cached index before swapping corpora; on rollback the
        // restored snapshot references force a clean rebuild on next search.
        resetSearchCache()
        const state = get()
        const snapshot = buildRecoverySnapshot(state)
        persistRecoverySnapshot(snapshot)
        try {
          set({
            entities,
            claims,
            selectedEntityId: null,
            editingEntityId: null,
            currentView: 'library',
            entityHistory: [entities],
            historyIndex: 0,
            graph: options?.graph,
            mindMap: options?.mindMap,
            links: options?.links,
            tags: options?.tags,
          })
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
            })
          } catch {
            set({
              ...SEED_STATE,
              selectedEntityId: null,
              editingEntityId: null,
              entityHistory: [seedEntities],
              historyIndex: 0,
            })
          }
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Import failed, state restored.',
          }
        }
      },

      resetStore: () => {
        // Returning to the seed workspace — release any large cached index.
        resetSearchCache()
        set({
          ...SEED_STATE,
          selectedEntityId: null,
          editingEntityId: null,
          entityHistory: [seedEntities],
          historyIndex: 0,
        })
      },
    }),
    {
      name: STUDIO_STORAGE_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Hydration pipeline lives in ./hydration — validation runs on EVERY
      // load (not just version mismatches), corrupt payloads are discarded
      // in favor of current state, and undo history is rebased onto the
      // hydrated corpus. Ephemeral fields (searchQuery, selection, palette)
      // stay out of localStorage so keystrokes never serialize the corpus.
      partialize: partializePersistedState,
      migrate: migratePersistedState,
      // Contextual wrapper pins zustand's store generic — the bare generic
      // helper leaks its type parameter into persist's inference.
      merge: (persistedState: unknown, currentState: StudioState) =>
        mergeHydratedState(persistedState, currentState),
    },
  ),
)

// Selectors
/** Returns entities filtered by search query, type, and sorted by the active sort criteria. */
export const useFilteredEntities = (): Entity[] => {
  const entities = useStudioStore((s) => s.entities)
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const typeFilter = useStudioStore((s) => s.typeFilter)
  const sortBy = useStudioStore((s) => s.sortBy)
  const sortDir = useStudioStore((s) => s.sortDir)

  return useMemo(() => {
    let list = entities
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)),
      )
    }
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'created') cmp = a.createdAt.localeCompare(b.createdAt)
      else cmp = a.updatedAt.localeCompare(b.updatedAt)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [entities, searchQuery, typeFilter, sortBy, sortDir])
}

/** Computes library statistics: entity counts by type, claim totals, and recent items. */
export const useStats = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)

  return useMemo(() => {
    const byType = entities.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1
        return acc
      },
      {} as Record<EntityType, number>,
    )
    const verified = claims.filter((c) => c.verification === 'verified').length
    const recent = [...entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    return {
      total: entities.length,
      claims: claims.length,
      verified,
      byType,
      recent,
    }
  }, [entities, claims])
}
