'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Entity, Claim, ViewId, ChatMessage, EntityType } from './types'
import { seedEntities, seedClaims, seedChat } from './seed-data'
import { search } from '@/lib/search/retrieval'
import { validatePersistedState } from './schema'
import { runMigrations, CURRENT_SCHEMA_VERSION } from './migrations'

const MAX_HISTORY = 50

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
  sendMessage: (content: string) => void
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
  importData: (entities: Entity[], claims: Claim[]) => void
  importWithRollback: (entities: Entity[], claims: Claim[]) => { success: boolean; error?: string }
  resetStore: () => void

  // Theme handled by next-themes — store tracks UI side effects only
}

function generateId(): string {
  return crypto.randomUUID()
}

// The default (seed) state — used on first load and as a fallback when a
// persisted state is missing fields. Kept here so both the store initializer
// and `resetStore` reference the same defaults.
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
}

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
        const e = get().entities.find((x) => x.id === id)
        if (!e) return
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
          claims: state.claims.map((c) => {
            if (c.id !== id) return c
            const now = new Date().toISOString()
            const historyEntry = updates.statement && updates.statement !== c.statement
              ? { statement: c.statement, editedAt: c.updatedAt ?? now }
              : null
            return {
              ...c,
              ...updates,
              updatedAt: now,
              version: (c.version ?? 1) + 1,
              editHistory: historyEntry
                ? [...(c.editHistory ?? []), historyEntry]
                : c.editHistory ?? [],
            }
          }),
        }))
      },

      deleteClaim: (id) => {
        set((state) => ({
          claims: state.claims.filter((c) => c.id !== id),
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

        setTimeout(() => {
          const { entities, claims } = get()
          const results = search(entities, claims, content, 5)
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
        }, 700)
      },

      clearChat: () => set({ chat: [], chatLoading: false }),

      setRightPanelOpen: (o) => set({ rightPanelOpen: o }),

      mobileDrawerOpen: false,
      setMobileDrawerOpen: (o) => set({ mobileDrawerOpen: o }),
      mobilePanelView: 'nav',
      setMobilePanelView: (v) => set({ mobilePanelView: v }),

      importData: (entities, claims) =>
        set({
          entities,
          claims,
          selectedEntityId: null,
          editingEntityId: null,
          currentView: 'library',
          entityHistory: [entities],
          historyIndex: 0,
        }),

      importWithRollback: (entities, claims) => {
        const state = get()
        const snapshot = {
          entities: structuredClone(state.entities),
          claims: structuredClone(state.claims),
          entityHistory: structuredClone(state.entityHistory),
          historyIndex: state.historyIndex,
        }
        try {
          set({
            entities,
            claims,
            selectedEntityId: null,
            editingEntityId: null,
            currentView: 'library',
            entityHistory: [entities],
            historyIndex: 0,
          })
          return { success: true }
        } catch (err) {
          try {
            set({
              entities: snapshot.entities,
              claims: snapshot.claims,
              entityHistory: snapshot.entityHistory,
              historyIndex: snapshot.historyIndex,
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

      resetStore: () =>
        set({
          ...SEED_STATE,
          selectedEntityId: null,
          editingEntityId: null,
          entityHistory: [seedEntities],
          historyIndex: 0,
        }),
    }),
    {
      name: 'do-knowledge-studio-store',
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable state — UI ephemerals (command palette,
      // mobile drawer, selection) are deliberately excluded so a refresh
      // lands the user on a clean view.
      partialize: (state) => ({
        entities: state.entities,
        claims: state.claims,
        chat: state.chat,
        currentView: state.currentView,
        searchQuery: state.searchQuery,
        typeFilter: state.typeFilter,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        rightPanelOpen: state.rightPanelOpen,
      }),
      // Validate and migrate persisted state. Invalid or corrupt data
      // falls back to seed defaults rather than crashing the app.
      // Runs versioned migrations to handle schema evolution.
      migrate: (persistedState: unknown) => {
        // Run versioned migrations first
        const migrated = runMigrations(persistedState)
        if (!migrated) {
          console.warn('Migration failed, using seed defaults')
          return persistedState
        }

        // Then validate with Zod schema — on failure, return raw input
        // so Zustand applies seed defaults (not the unvalidated migration output).
        const result = validatePersistedState(migrated)
        if (result.success) {
          return result.data
        }
        console.warn('Persisted state failed validation after migration:', result.errors)
        return persistedState
      },
    },
  ),
)

// Selectors
export function useFilteredEntities(): Entity[] {
  const entities = useStudioStore((s) => s.entities)
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const typeFilter = useStudioStore((s) => s.typeFilter)
  const sortBy = useStudioStore((s) => s.sortBy)
  const sortDir = useStudioStore((s) => s.sortDir)

  return useMemo(() => {
    let list = entities
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
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

export function useStats() {
  const { entities, claims } = useStudioStore()
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
}
