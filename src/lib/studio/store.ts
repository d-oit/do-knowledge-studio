'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Entity, Claim, ViewId, ChatMessage, EntityType } from './types'
import { seedEntities, seedClaims, seedChat } from './seed-data'

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
  deleteEntity: (id: string) => void

  // Claims
  claims: Claim[]
  addClaim: (claim: Omit<Claim, 'id'>) => void

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
  resetStore: () => void

  // Theme handled by next-themes — store tracks UI side effects only
}

function generateId(prefix = 'e'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
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
      saveEntity: (e) => {
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
      deleteEntity: (id) =>
        set((state) => ({
          entities: state.entities.filter((x) => x.id !== id),
          claims: state.claims.filter((c) => c.entityId !== id),
          selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
        })),

      addClaim: (claim) => {
        const fullClaim: Claim = { ...claim, id: `c-${Date.now().toString(36)}` }
        set((state) => ({ claims: [fullClaim, ...state.claims] }))
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setTypeFilter: (t) => set({ typeFilter: t }),
      setSortBy: (s) => set({ sortBy: s }),
      setSortDir: (d) => set({ sortDir: d }),

      sendMessage: (content) => {
        const userMsg: ChatMessage = {
          id: generateId('m'),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        }
        set((state) => ({ chat: [...state.chat, userMsg], chatLoading: true }))

        // Simulated RAG response — score entities by word overlap
        setTimeout(() => {
          const { entities } = get()
          const words = content
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3 && !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'your', 'about', 'please', 'could', 'would', 'should'].includes(w))
          const scored = entities
            .map((e) => {
              const haystack = `${e.name} ${e.description} ${e.tags.join(' ')}`.toLowerCase()
              let score = 0
              for (const w of words) {
                if (haystack.includes(w)) score += 1
                if (e.name.toLowerCase().includes(w)) score += 2
              }
              return { e, score }
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
          const matched = scored.slice(0, 3).map((x) => x.e)
          const cited = matched.map((e) => ({
            entityId: e.id,
            entityName: e.name,
            snippet: e.description.slice(0, 140) + '…',
          }))
          const reply: ChatMessage = {
            id: generateId('m'),
            role: 'assistant',
            content: matched.length
              ? `Based on ${matched.length === 1 ? 'an entity' : `${matched.length} entities`} in your library, here is what I found. ${matched[0].description.slice(0, 200)} You can open the cited sources for full detail, or ask me to compare them.`
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
          // Reset transient selection / editing so we don't point at a stale id.
          selectedEntityId: null,
          editingEntityId: null,
          currentView: 'library',
        }),

      resetStore: () =>
        set({
          ...SEED_STATE,
          selectedEntityId: null,
          editingEntityId: null,
        }),
    }),
    {
      name: 'do-knowledge-studio-store',
      version: 1,
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
      // Forward-compatible: return persisted state as-is. The merge step
      // below (default Zustand shallow merge) keeps any new fields from
      // the seed defaults if the persisted state is missing them.
      migrate: (persistedState: unknown) => persistedState as unknown,
    },
  ),
)

// Selectors
export function useFilteredEntities(): Entity[] {
  const { entities, searchQuery, typeFilter, sortBy, sortDir } = useStudioStore()
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
