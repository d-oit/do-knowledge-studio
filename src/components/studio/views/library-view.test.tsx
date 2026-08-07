import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

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

vi.mock('../ui/shared-primitives', () => ({
  ToggleButtonGroup: ({ children }: { children?: ReactNode; label?: string }) => (
    <div data-testid="toggle-group">{children}</div>
  ),
}))

const mockSetTypeFilter = vi.fn()
const mockSetSortBy = vi.fn()
const mockSetSortDir = vi.fn()
const mockStartEdit = vi.fn()
const mockStartNew = vi.fn()
const mockSetSearchQuery = vi.fn()

const mockEntities = [
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

let currentTypeFilter = 'all'
let currentSortBy = 'updated'
let currentSortDir = 'asc'
let currentSearchQuery = ''
let currentRightPanelOpen = false
let currentEntities = mockEntities
let filteredEntities = mockEntities

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: currentEntities,
      typeFilter: currentTypeFilter,
      setTypeFilter: mockSetTypeFilter,
      sortBy: currentSortBy,
      setSortBy: mockSetSortBy,
      sortDir: currentSortDir,
      setSortDir: mockSetSortDir,
      startEdit: mockStartEdit,
      startNew: mockStartNew,
      searchQuery: currentSearchQuery,
      setSearchQuery: mockSetSearchQuery,
      rightPanelOpen: currentRightPanelOpen,
    }),
  useFilteredEntities: () => filteredEntities,
}))

import { LibraryView } from './library-view'

describe('LibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    filteredEntities = mockEntities
    currentTypeFilter = 'all'
    currentSortBy = 'updated'
    currentSortDir = 'asc'
    currentSearchQuery = ''
    currentRightPanelOpen = false
  })

  it('renders empty state when no entities', () => {
    currentEntities = []
    filteredEntities = []
    render(<LibraryView />)
    expect(screen.getByText('No entities yet')).toBeDefined()
    expect(screen.getByText(/Create your first entity/)).toBeDefined()
  })

  it('renders entity cards in grid view', () => {
    render(<LibraryView />)
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.getByText('Beta Note')).toBeDefined()
    expect(screen.getByText('First concept')).toBeDefined()
    expect(screen.getByText('A note')).toBeDefined()
  })

  it('search input exists and has correct placeholder', () => {
    render(<LibraryView />)
    expect(screen.getByPlaceholderText('Filter by name, description, or tag…')).toBeDefined()
  })

  it('type filter buttons exist with correct labels', () => {
    render(<LibraryView />)
    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText('Notes')).toBeDefined()
    expect(screen.getByText('Concepts')).toBeDefined()
    expect(screen.getByText('People')).toBeDefined()
    expect(screen.getByText('Projects')).toBeDefined()
  })

  it('sort controls exist', () => {
    render(<LibraryView />)
    expect(screen.getByLabelText('Sort by')).toBeDefined()
    expect(screen.getByLabelText(/Sort (ascending|descending)/)).toBeDefined()
  })

  it('new button exists', () => {
    render(<LibraryView />)
    expect(screen.getByText('New')).toBeDefined()
  })

  it('clicking entity card calls startEdit', () => {
    render(<LibraryView />)
    const card = screen.getByText('Alpha Concept')
    card.closest('button')?.click()
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('no-matches state shows when filters exclude all', () => {
    filteredEntities = []
    render(<LibraryView />)
    expect(screen.getByText('No matches found')).toBeDefined()
    expect(screen.getByText(/Try adjusting your search terms or filters/)).toBeDefined()
  })

  it('displays showing count', () => {
    render(<LibraryView />)
    expect(screen.getAllByText(/Showing 2 entit(y|ies)/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows singular entity count', () => {
    filteredEntities = [mockEntities[0]]
    render(<LibraryView />)
    expect(screen.getAllByText(/Showing 1 entity/).length).toBeGreaterThanOrEqual(1)
  })

  it('search input has correct aria-label', () => {
    render(<LibraryView />)
    expect(screen.getByLabelText('Search library')).toBeDefined()
  })

  it('updates the search query and clears an active search', () => {
    currentSearchQuery = 'alpha'
    render(<LibraryView />)
    const searchInput = screen.getByLabelText('Search library')
    fireEvent.change(searchInput, { target: { value: 'beta' } })
    expect(mockSetSearchQuery).toHaveBeenCalledWith('beta')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
  })

  it('clears all filters from the no-matches state', () => {
    currentSearchQuery = 'missing'
    currentTypeFilter = 'concept'
    filteredEntities = []
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    expect(mockSetTypeFilter).toHaveBeenCalledWith('all')
  })

  it('changes type, sort, and sort direction controls', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))
    expect(mockSetTypeFilter).toHaveBeenCalledWith('note')

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'name' },
    })
    expect(mockSetSortBy).toHaveBeenCalledWith('name')

    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }))
    expect(mockSetSortDir).toHaveBeenCalledWith('desc')
  })

  it('renders list view and opens entities by click and keyboard', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'List view' }))

    const rows = within(screen.getByRole('table')).getAllByRole('link')
    expect(rows).toHaveLength(2)
    fireEvent.click(rows[0])
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')

    fireEvent.keyDown(rows[1], { key: 'Enter' })
    fireEvent.keyDown(rows[1], { key: ' ' })
    expect(mockStartEdit).toHaveBeenCalledWith('ent-2')
    expect(mockStartEdit).toHaveBeenCalledTimes(3)
  })

  it('renders tag overflow in grid view', () => {
    currentEntities = [{ ...mockEntities[0], tags: ['one', 'two', 'three'] }]
    filteredEntities = currentEntities
    render(<LibraryView />)
    expect(screen.getByText('+1')).toBeDefined()
  })

  it('advanced filters disclosure is collapsed by default', () => {
    render(<LibraryView />)
    const toggle = screen.getByRole('button', { name: /Advanced filters/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Tag contains')).toBeNull()
  })

  it('opens advanced filters and filters by tag', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))
    expect(screen.getByLabelText('Tag contains')).toBeDefined()

    const tagInput = screen.getByLabelText('Tag contains')
    fireEvent.change(tagInput, { target: { value: 'alpha' } })
    // Only Alpha Concept has the 'alpha' tag
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.queryByText('Beta Note')).toBeNull()
  })

  it('filters to entities with descriptions when toggled', () => {
    filteredEntities = [
      mockEntities[0],
      { ...mockEntities[1], description: '' },
    ]
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))
    const checkbox = screen.getByLabelText('Only show entities with a description')
    fireEvent.click(checkbox)
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.queryByText('Beta Note')).toBeNull()
  })

  it('shows active-filter badge and clears advanced filters', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))
    const tagInput = screen.getByLabelText('Tag contains')
    fireEvent.change(tagInput, { target: { value: 'alpha' } })

    const badge = screen.getByText('1')
    expect(badge).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Clear advanced filters' }))
    expect(screen.getByLabelText('Tag contains')).toHaveValue('')
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.getByText('Beta Note')).toBeDefined()
  })

  it('uses the wider layout when the right panel is closed', () => {
    currentRightPanelOpen = false
    const { container, rerender } = render(<LibraryView />)
    expect(container.firstElementChild).toHaveClass('max-w-6xl')

    currentRightPanelOpen = true
    rerender(<LibraryView />)
    expect(container.firstElementChild).toHaveClass('max-w-5xl')
  })

  it('starts a new entity from both New actions', () => {
    const { unmount } = render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /^New$/ }))
    expect(mockStartNew).toHaveBeenCalledTimes(1)
    unmount()

    currentEntities = []
    filteredEntities = []
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Create your first entity/ }))
    expect(mockStartNew).toHaveBeenCalledTimes(2)
  })
})
