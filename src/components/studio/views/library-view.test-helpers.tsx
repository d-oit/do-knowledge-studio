import type { ReactNode } from 'react'
import type * as SharedPrimitives from '../ui/shared-primitives'
import { vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    FileText: Icon,
    Lightbulb: Icon,
    User: Icon,
    FolderKanban: Icon,
    LayoutGrid: Icon,
    List: Icon,
    ArrowUpDown: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Plus: Icon,
    Clock: Icon,
    Search: Icon,
    X: Icon,
    Wifi: Icon,
    WifiOff: Icon,
    Copy: Icon,
    Check: Icon,
    RefreshCw: Icon,
    Trash2: Icon,
    History: Icon,
    Loader2: Icon,
    QrCode: Icon,
    Camera: Icon,
    Radio: Icon,
    Users: Icon,
    SlidersHorizontal: Icon,
    Tag: Icon,
    ChevronDown: Icon,
    CheckIcon: Icon,
    Sparkles: Icon,
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../ui/shared-primitives', async () => {
  // Keep the real view chrome so the library empty states render their actions.
  const actual = await vi.importActual<typeof SharedPrimitives>('../ui/shared-primitives')
  return {
    ...actual,
    ToggleButtonGroup: ({ children }: { children?: ReactNode; label?: string }) => (
      <div data-testid="toggle-group">{children}</div>
    ),
  }
})

export const mockSetTypeFilter = vi.fn()
export const mockSetSortBy = vi.fn()
export const mockSetSortDir = vi.fn()
export const mockStartEdit = vi.fn()
export const mockStartNew = vi.fn()
export const mockSetSearchQuery = vi.fn()
export const mockSetSemanticSearchEnabled = vi.fn()
export const mockSetTagQuery = vi.fn()
export const mockSetHasDescriptionOnly = vi.fn()
export const mockSetViewMode = vi.fn()
export const mockSetShowAll = vi.fn()

export const mockEntities = [
  {
    id: 'ent-1',
    name: 'Alpha Concept',
    type: 'concept' as const,
    description: 'First concept',
    content: '',
    tags: ['alpha'],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-15T00:00:00Z',
    links: [],
  },
  {
    id: 'ent-2',
    name: 'Beta Note',
    type: 'note' as const,
    description: 'A note',
    content: '',
    tags: ['beta', 'gamma'],
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-07-01T00:00:00Z',
    links: [],
  },
]

export const libraryViewState = {
  currentTypeFilter: 'all',
  currentSortBy: 'updated',
  currentSortDir: 'asc',
  currentSearchQuery: '',
  currentRightPanelOpen: false,
  currentSemanticSearchEnabled: false,
  currentTagQuery: '',
  currentHasDescriptionOnly: false,
  currentViewMode: 'grid',
  currentShowAll: false,
  currentEntities: mockEntities,
  filteredEntities: mockEntities,
}

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: libraryViewState.currentEntities,
      typeFilter: libraryViewState.currentTypeFilter,
      setTypeFilter: mockSetTypeFilter,
      sortBy: libraryViewState.currentSortBy,
      setSortBy: mockSetSortBy,
      sortDir: libraryViewState.currentSortDir,
      setSortDir: mockSetSortDir,
      tagQuery: libraryViewState.currentTagQuery,
      setTagQuery: mockSetTagQuery,
      hasDescriptionOnly: libraryViewState.currentHasDescriptionOnly,
      setHasDescriptionOnly: mockSetHasDescriptionOnly,
      viewMode: libraryViewState.currentViewMode,
      setViewMode: mockSetViewMode,
      showAll: libraryViewState.currentShowAll,
      setShowAll: mockSetShowAll,
      startEdit: mockStartEdit,
      startNew: mockStartNew,
      searchQuery: libraryViewState.currentSearchQuery,
      setSearchQuery: mockSetSearchQuery,
      rightPanelOpen: libraryViewState.currentRightPanelOpen,
      semanticSearchEnabled: libraryViewState.currentSemanticSearchEnabled,
      setSemanticSearchEnabled: mockSetSemanticSearchEnabled,
    }),
  useFilteredEntities: () => libraryViewState.filteredEntities,
}))

const { mockSearchSemantic } = vi.hoisted(() => ({
  mockSearchSemantic: vi.fn<
    (
      entities: unknown,
      claims: unknown,
      query: string,
      limit?: number,
      signal?: AbortSignal,
      filter?: (doc: { id: string; type: 'entity' | 'claim'; entityType?: string }) => boolean,
    ) => Promise<unknown>
  >(),
}))

vi.mock('@/lib/search/search-worker-client', () => ({
  searchSemantic: mockSearchSemantic,
}))
export const getMockSearchSemantic = () => mockSearchSemantic

export const resetLibraryViewMocks = () => {
  vi.clearAllMocks()
  libraryViewState.currentEntities = mockEntities
  libraryViewState.filteredEntities = mockEntities
  libraryViewState.currentTypeFilter = 'all'
  libraryViewState.currentSortBy = 'updated'
  libraryViewState.currentSortDir = 'asc'
  libraryViewState.currentSearchQuery = ''
  libraryViewState.currentRightPanelOpen = false
  libraryViewState.currentSemanticSearchEnabled = false
  libraryViewState.currentTagQuery = ''
  libraryViewState.currentHasDescriptionOnly = false
  libraryViewState.currentViewMode = 'grid'
  libraryViewState.currentShowAll = false
}

export const SEMANTIC_DEBOUNCE_PROBE_MS = 400
