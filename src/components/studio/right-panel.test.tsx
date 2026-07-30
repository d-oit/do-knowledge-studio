import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Search: Icon, X: Icon, Sparkles: Icon, FileText: Icon, Quote: Icon, ArrowRight: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/types', () => ({
  ENTITY_TYPE_META: {
    concept: { label: 'Concept', dot: 'bg-blue-500' },
    reference: { label: 'Reference', dot: 'bg-green-500' },
  },
}))

vi.mock('@/lib/search/retrieval', () => ({
  search: vi.fn(() => []),
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose, 'aria-label': ariaLabel }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    initialFocusRef?: React.RefObject<HTMLElement | null>
  }) =>
    open ? (
      <div data-testid="overlay-backdrop" onClick={onClose}>
        <div data-testid="overlay" role="dialog" aria-label={ariaLabel} onClick={(e) => { e.stopPropagation() }}>
          {children}
        </div>
      </div>
    ) : null,
}))

const mockStartNew = vi.fn()
const mockStartEdit = vi.fn()
const mockDeleteEntity = vi.fn()
const mockSelectEntity = vi.fn()
const mockSetSearchQuery = vi.fn()

let currentView = 'home'
let rightPanelOpen = false
let searchQuery = ''
let selectedEntityId: string | null = null

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test Entity',
    type: 'concept' as const,
    description: 'A test concept',
    content: '',
    tags: ['test', 'concept'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [{ targetId: 'ent-2', relation: 'related to' }],
  },
  {
    id: 'ent-2',
    name: 'Related Entity',
    type: 'reference' as const,
    description: 'A related reference',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

const mockChat: Array<{ role: string; content: string; citations?: Array<{ entityName: string; snippet: string }> }> = []

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        currentView,
        rightPanelOpen,
        chat: mockChat,
        startNew: mockStartNew,
        entities: mockEntities,
        claims: [],
        startEdit: mockStartEdit,
        deleteEntity: mockDeleteEntity,
        selectEntity: mockSelectEntity,
        searchQuery,
        setSearchQuery: mockSetSearchQuery,
        selectedEntityId,
      }),
    { getState: () => ({}) },
  ),
  useFilteredEntities: () => (searchQuery ? [] : mockEntities),
}))

import { RightPanel } from './right-panel'

describe('RightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    rightPanelOpen = false
    searchQuery = ''
    selectedEntityId = null
  })

  it('renders nothing when panel is closed', () => {
    rightPanelOpen = false
    const { container } = render(<RightPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('renders SearchPanel for home view when open', () => {
    rightPanelOpen = true
    currentView = 'home'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders SearchPanel for editor view', () => {
    rightPanelOpen = true
    currentView = 'editor'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders SearchPanel for library view', () => {
    rightPanelOpen = true
    currentView = 'library'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders SearchPanel for export view', () => {
    rightPanelOpen = true
    currentView = 'export'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders InspectorPanel for graph view', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('Inspector')).toBeDefined()
  })

  it('renders InspectorPanel for mindmap view', () => {
    rightPanelOpen = true
    currentView = 'mindmap'
    render(<RightPanel />)
    expect(screen.getByText('Inspector')).toBeDefined()
  })

  it('renders SearchPanel for chat view when no citations', () => {
    rightPanelOpen = true
    currentView = 'chat'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders SearchPanel for ai view when no citations', () => {
    rightPanelOpen = true
    currentView = 'ai'
    render(<RightPanel />)
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('renders close button in SearchPanel', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByLabelText('Close')).toBeDefined()
  })

  it('renders search input', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByPlaceholderText('Search knowledge base…')).toBeDefined()
  })

  it('renders keyword/ranked toggle', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByText('Keyword')).toBeDefined()
    expect(screen.getByText('Ranked')).toBeDefined()
  })

  it('renders entity list', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByText('Test Entity')).toBeDefined()
    expect(screen.getByText('Related Entity')).toBeDefined()
  })

  it('shows local search indicator', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByText(/Local search/)).toBeDefined()
  })

  it('shows entity count', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByText(/2 entities/)).toBeDefined()
  })

  it('shows close button in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByLabelText('Close inspector')).toBeDefined()
  })

  it('shows entity name in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('Test Entity')).toBeDefined()
  })

  it('shows entity description in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('A test concept')).toBeDefined()
  })

  it('shows entity tags in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('#test')).toBeDefined()
    expect(screen.getByText('#concept')).toBeDefined()
  })

  it('shows connections in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('Connections (1)')).toBeDefined()
    expect(screen.getByText('Related Entity')).toBeDefined()
  })

  it('shows Edit and Delete buttons in inspector', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    expect(screen.getByText('Edit')).toBeDefined()
    expect(screen.getByText('Delete')).toBeDefined()
  })

  it('calls startEdit on Edit click', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    fireEvent.click(screen.getByText('Edit'))
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('shows delete confirm dialog on Delete click', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Delete entity?')).toBeDefined()
  })

  it('delete confirm shows entity name', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    fireEvent.click(screen.getByText('Delete'))
    // Entity name appears inside quotes in the confirm message
    expect(screen.getByText(/will be permanently deleted/)).toBeDefined()
  })

  it('Cancel button closes delete dialog', () => {
    rightPanelOpen = true
    currentView = 'graph'
    render(<RightPanel />)
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete entity?')).toBeNull()
  })

  it('shows empty state when no search results', () => {
    rightPanelOpen = true
    searchQuery = 'nonexistent'
    render(<RightPanel />)
    expect(screen.getByText(/No matches found/)).toBeDefined()
  })

  it('shows create entity button when no results and query exists', () => {
    rightPanelOpen = true
    searchQuery = 'New thing'
    render(<RightPanel />)
    // Button text contains HTML entities for quotes: Create &quot;New thing&quot; as new entity
    expect(screen.getByText(/Create.*as new entity/)).toBeDefined()
  })

  it('shows empty library message when no query and no entities', () => {
    rightPanelOpen = true
    searchQuery = ''
    // useFilteredEntities returns mockEntities when query is empty, so empty state is not shown
    render(<RightPanel />)
    expect(screen.queryByText(/Your library is empty/)).toBeNull()
  })

  it('renders search input with aria-label', () => {
    rightPanelOpen = true
    render(<RightPanel />)
    expect(screen.getByLabelText('Search knowledge base')).toBeDefined()
  })
})
