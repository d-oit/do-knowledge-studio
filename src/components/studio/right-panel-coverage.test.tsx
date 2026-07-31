import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { ReactNode } from 'react'

// Hoisted so the vi.mock factories (hoisted above imports) can reference these safely.
const storeState = vi.hoisted(() => {
  const baseEntities = [
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
  return {
    baseEntities,
    entities: [...baseEntities] as Array<Record<string, unknown>>,
    claims: [] as Array<Record<string, unknown>>,
    chat: [] as Array<{
      role: string
      content: string
      citations?: Array<{ entityName: string; snippet: string }>
    }>,
    currentView: 'home',
    rightPanelOpen: true,
    searchQuery: '',
    selectedEntityId: null as string | null,
    startNew: vi.fn(),
    startEdit: vi.fn(),
    deleteEntity: vi.fn(),
    selectEntity: vi.fn(),
    setSearchQuery: vi.fn(),
  }
})

const searchMocks = vi.hoisted(() => ({
  search: vi.fn(() => [] as Array<Record<string, unknown>>),
}))

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
  search: searchMocks.search,
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({
    children,
    open,
    onClose,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    initialFocusRef?: React.RefObject<HTMLElement | null>
  }) =>
    open ? (
      <div data-testid="overlay-backdrop" onClick={onClose}>
        <div
          data-testid="overlay"
          role="dialog"
          aria-label={ariaLabel}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {children}
        </div>
      </div>
    ) : null,
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        currentView: storeState.currentView,
        rightPanelOpen: storeState.rightPanelOpen,
        chat: storeState.chat,
        startNew: storeState.startNew,
        entities: storeState.entities,
        claims: storeState.claims,
        startEdit: storeState.startEdit,
        deleteEntity: storeState.deleteEntity,
        selectEntity: storeState.selectEntity,
        searchQuery: storeState.searchQuery,
        setSearchQuery: storeState.setSearchQuery,
        selectedEntityId: storeState.selectedEntityId,
      }),
    { getState: () => ({}) },
  ),
  useFilteredEntities: () => (storeState.searchQuery ? [] : storeState.entities),
}))

import { RightPanel } from './right-panel'

const openGraphView = () => {
  storeState.currentView = 'graph'
  render(<RightPanel />)
}

describe('RightPanel branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.currentView = 'home'
    storeState.rightPanelOpen = true
    storeState.searchQuery = ''
    storeState.selectedEntityId = null
    storeState.entities = [...storeState.baseEntities]
    storeState.chat = []
    searchMocks.search.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('CitationsPanel', () => {
    it('renders cited sources when chat view has citations', () => {
      storeState.currentView = 'chat'
      storeState.chat = [
        { role: 'user', content: 'q' },
        {
          role: 'assistant',
          content: 'a',
          citations: [{ entityName: 'Entity One', snippet: 'Snippet one' }],
        },
      ]
      render(<RightPanel />)
      expect(screen.getByText('Cited sources')).toBeDefined()
      expect(screen.getByText('Entity One')).toBeDefined()
      expect(screen.getByText('Snippet one')).toBeDefined()
    })

    it('shows citations empty state when last assistant has no citations', () => {
      storeState.currentView = 'chat'
      storeState.chat = [
        { role: 'assistant', content: 'first', citations: [{ entityName: 'A', snippet: 'B' }] },
        { role: 'assistant', content: 'last' },
      ]
      render(<RightPanel />)
      expect(screen.getByText('Cited sources')).toBeDefined()
      expect(screen.getByText(/appear here for verification/)).toBeDefined()
    })

    it('shows grounded footer with entity count', () => {
      storeState.currentView = 'chat'
      storeState.chat = [
        {
          role: 'assistant',
          content: 'a',
          citations: [{ entityName: 'Entity One', snippet: 'Snippet one' }],
        },
      ]
      render(<RightPanel />)
      expect(screen.getByText(/Grounded in 2 local entities/)).toBeDefined()
    })
  })

  describe('InspectorPanel', () => {
    it('shows empty inspector when no entities exist', () => {
      storeState.currentView = 'graph'
      storeState.entities = []
      render(<RightPanel />)
      expect(screen.getByText('Select a node to inspect.')).toBeDefined()
    })

    it('falls back to first entity when selected id is unknown', () => {
      storeState.selectedEntityId = 'missing'
      openGraphView()
      expect(screen.getByText('Test Entity')).toBeDefined()
    })

    it('closes inspector via close button', () => {
      openGraphView()
      fireEvent.click(screen.getByLabelText('Close inspector'))
      expect(storeState.selectEntity).toHaveBeenCalledWith(null)
    })

    it('selects entity when a connection is clicked', () => {
      openGraphView()
      fireEvent.click(screen.getByText('Related Entity'))
      expect(storeState.selectEntity).toHaveBeenCalledWith('ent-2')
    })

    it('filters out links with missing targets', () => {
      storeState.entities = [
        { ...storeState.baseEntities[0], links: [{ targetId: 'missing', relation: 'ghost' }] },
        ...storeState.baseEntities.slice(1),
      ]
      openGraphView()
      expect(screen.getByText('Connections (1)')).toBeDefined()
      expect(screen.queryByText('ghost')).toBeNull()
    })

    it('confirm delete calls deleteEntity and closes dialog', () => {
      openGraphView()
      fireEvent.click(screen.getByText('Delete'))
      const dialog = screen.getByRole('dialog', { name: 'Confirm delete' })
      fireEvent.click(within(dialog).getByText('Delete'))
      expect(storeState.deleteEntity).toHaveBeenCalledWith('ent-1')
      expect(storeState.selectEntity).toHaveBeenCalledWith(null)
      expect(screen.queryByText('Delete entity?')).toBeNull()
    })
  })

  describe('SearchPanel ranked mode', () => {
    it('shows empty library state when ranked search returns nothing', () => {
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      expect(screen.getByText('Your library is empty.')).toBeDefined()
    })

    it('switches to ranked mode and calls search', () => {
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      expect(searchMocks.search).toHaveBeenCalled()
    })

    it('renders ranked entity results with meta label', () => {
      searchMocks.search.mockReturnValue([
        { id: 'ent-1', name: 'Test Entity', snippet: 'Snippet one', score: 0.9, type: 'entity' },
      ])
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      expect(screen.getByText('Snippet one')).toBeDefined()
      expect(screen.getByText('0.9')).toBeDefined()
      expect(screen.getByText('Concept')).toBeDefined()
    })

    it('renders ranked claim results resolved via entityId', () => {
      searchMocks.search.mockReturnValue([
        {
          id: 'claim-1',
          name: 'Claim One',
          snippet: 'Claim snippet',
          score: 0.8,
          type: 'claim',
          entityId: 'ent-2',
        },
      ])
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      expect(screen.getByText('Claim One')).toBeDefined()
      expect(screen.getByText('Reference')).toBeDefined()
    })

    it('renders ranked result without meta when target unresolved', () => {
      searchMocks.search.mockReturnValue([
        { id: 'ghost', name: 'Ghost', snippet: 'No entity', score: 0.7, type: 'entity' },
      ])
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      expect(screen.getByText('Ghost')).toBeDefined()
      expect(screen.queryByText('Concept')).toBeNull()
    })

    it('ranked result click calls startEdit with target id', () => {
      searchMocks.search.mockReturnValue([
        { id: 'ent-2', name: 'Related Entity', snippet: 'Snippet two', score: 0.6, type: 'entity' },
      ])
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      fireEvent.click(screen.getByLabelText(/score 0.60/))
      expect(storeState.startEdit).toHaveBeenCalledWith('ent-2')
    })

    it('does not startEdit when ranked result has no target', () => {
      searchMocks.search.mockReturnValue([
        { id: 'claim-9', name: 'Orphan', snippet: 'No entity id', score: 0.5, type: 'claim' },
      ])
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Ranked'))
      fireEvent.click(screen.getByText('Orphan'))
      expect(storeState.startEdit).not.toHaveBeenCalled()
    })

  })

  describe('SearchPanel keyword mode', () => {
    it('keyword result click calls startEdit', () => {
      render(<RightPanel />)
      fireEvent.click(screen.getByText('Test Entity'))
      expect(storeState.startEdit).toHaveBeenCalledWith('ent-1')
    })

    it('create entity button calls startNew (name dropped by wrapper)', () => {
      storeState.searchQuery = 'New thing'
      render(<RightPanel />)
      fireEvent.click(screen.getByText(/Create.*as new entity/))
      // RightPanel passes onCreateEntity={() => startNew()}; startNew takes no name arg
      expect(storeState.startNew).toHaveBeenCalled()
    })
  })
})
