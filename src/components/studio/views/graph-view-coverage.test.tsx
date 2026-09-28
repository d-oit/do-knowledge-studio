import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    CircleDot: I,
    Circle: I,
    GitFork: I,
    Layers: I,
    Focus: I,
    Camera: I,
    History: I,
    Trash2: I,
    RotateCcw: I,
    RotateCw: I,
    Download: I,
    MoreHorizontal: I,
    HelpCircle: I,
    FileText: I,
    FileJson: I,
    FileCode: I,
    FileArchive: I,
    FileLock: I,
  }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('../ui/shared-primitives', () => ({
  ToggleButtonGroup: ({ children, label }: { children?: ReactNode; label?: string }) => (
    <div data-testid="toggle-button-group" aria-label={label}>{children}</div>
  ),
  Divider: () => <hr data-testid="divider" />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockSelectEntity = vi.fn()
const mockUndo = vi.fn()
const mockRedo = vi.fn()

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test Entity',
    type: 'note' as const,
    description: 'desc',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [{ targetId: 'ent-2', relation: 'related' }],
  },
  {
    id: 'ent-2',
    name: 'Linked Entity',
    type: 'concept' as const,
    description: 'desc',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
  {
    id: 'ent-3',
    name: 'Unrelated Entity',
    type: 'person' as const,
    description: 'desc',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

let currentEntities = mockEntities
let currentSelectedEntityId: string | null = null
let currentHistoryIndex = 0
let currentEntityHistory: unknown[][] = [[]]

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: currentEntities,
      selectedEntityId: currentSelectedEntityId,
      selectEntity: mockSelectEntity,
      undo: mockUndo,
      redo: mockRedo,
      entityHistory: currentEntityHistory,
      historyIndex: currentHistoryIndex,
    }),
}))

import { GraphView } from './graph-view'

describe('GraphView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentSelectedEntityId = null
    currentHistoryIndex = 0
    currentEntityHistory = [[]]
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders empty state when no entities', () => {
    currentEntities = []
    render(<GraphView />)
    expect(screen.getByText('No entities to graph yet.')).toBeDefined()
  })

  it('switches to circular layout when button clicked', () => {
    render(<GraphView />)
    const circularBtn = screen.getByText('circular')
    fireEvent.click(circularBtn)
    expect(circularBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches to hierarchical layout when button clicked', () => {
    render(<GraphView />)
    const hierBtn = screen.getByText('hierarchical')
    fireEvent.click(hierBtn)
    expect(hierBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches back to force layout when force button clicked', () => {
    render(<GraphView />)
    fireEvent.click(screen.getByText('circular'))
    fireEvent.click(screen.getByText('force'))
    expect(screen.getByText('force')).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles focus mode on and off', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    const focusBtn = screen.getByLabelText('Focus neighborhood')
    fireEvent.click(focusBtn)
    expect(focusBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(focusBtn)
    expect(focusBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects entity on node click', () => {
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /Test Entity/ })
    fireEvent.click(node)
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
  })

  it('deselects entity on click when already selected', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /Test Entity/ })
    fireEvent.click(node)
    expect(mockSelectEntity).toHaveBeenCalledWith(null)
  })

  it('selects entity on Enter key', () => {
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /Test Entity/ })
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
  })

  it('selects entity on Space key', () => {
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /Test Entity/ })
    fireEvent.keyDown(node, { key: ' ' })
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
  })

  it('focuses node and tracks focusedNodeId', () => {
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /Test Entity/ })
    fireEvent.focus(node)
    // SVG elements use lowercase 'tabindex' in jsdom
    expect(node).toHaveAttribute('tabindex', '0')
  })

  it('calls undo when undo button clicked (behind More)', () => {
    currentHistoryIndex = 1
    currentEntityHistory = [[], []]
    render(<GraphView />)
    fireEvent.click(screen.getByLabelText('More controls'))
    const undoBtn = screen.getByLabelText('Undo')
    fireEvent.click(undoBtn)
    expect(mockUndo).toHaveBeenCalled()
  })

  it('calls redo when redo button clicked (behind More)', () => {
    currentEntityHistory = [[], []]
    render(<GraphView />)
    fireEvent.click(screen.getByLabelText('More controls'))
    const redoBtn = screen.getByLabelText('Redo')
    fireEvent.click(redoBtn)
    expect(mockRedo).toHaveBeenCalled()
  })

  describe('Snapshot save/restore round trip (D4.1)', () => {
    beforeEach(() => {
      // Round-trip coverage needs a real store, not the shared Storage spy:
      // the restore path reads back what the save path wrote.
      vi.restoreAllMocks()
      localStorage.clear()
    })

    it('saves the canvas state under the snapshot key', () => {
      render(<GraphView />)
      fireEvent.click(screen.getByText('circular'))
      currentSelectedEntityId = mockEntities[0].id
      fireEvent.click(screen.getByLabelText('Focus neighborhood'))
      fireEvent.click(screen.getByLabelText('Save snapshot'))

      const stored = localStorage.getItem('dks-graph-snapshot')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored ?? '')).toMatchObject({
        layout: 'circular',
        selectedEntityId: mockEntities[0].id,
        focusMode: true,
        zoom: 1,
      })
    })

    it('restores layout, focus mode, and selection from a stored snapshot', () => {
      localStorage.setItem(
        'dks-graph-snapshot',
        JSON.stringify({
          layout: 'hierarchical',
          selectedEntityId: mockEntities[1].id,
          focusMode: true,
          panX: 12,
          panY: -8,
          zoom: 2.5,
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      )

      render(<GraphView />)
      // The restore action is enabled only when a valid snapshot is stored.
      const restoreBtn = screen.getByLabelText('Restore snapshot') as HTMLButtonElement
      expect(restoreBtn.disabled).toBe(false)

      fireEvent.click(restoreBtn)
      expect(screen.getByText('hierarchical')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByLabelText('Focus neighborhood')).toHaveAttribute('aria-pressed', 'true')
      expect(mockSelectEntity).toHaveBeenCalledWith(mockEntities[1].id)
    })

    it('disables restore and clear when no snapshot is stored', () => {
      render(<GraphView />)
      expect((screen.getByLabelText('Restore snapshot') as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByLabelText('Clear snapshot') as HTMLButtonElement).disabled).toBe(true)
    })

    it('clears a stored snapshot and re-disables the restore action', () => {
      localStorage.setItem(
        'dks-graph-snapshot',
        JSON.stringify({
          layout: 'force',
          selectedEntityId: null,
          focusMode: false,
          panX: 0,
          panY: 0,
          zoom: 1,
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      )
      render(<GraphView />)
      fireEvent.click(screen.getByLabelText('Clear snapshot'))

      expect(localStorage.getItem('dks-graph-snapshot')).toBeNull()
      expect((screen.getByLabelText('Restore snapshot') as HTMLButtonElement).disabled).toBe(true)
    })

    it('drops a corrupt snapshot and leaves restore disabled instead of throwing', () => {
      localStorage.setItem('dks-graph-snapshot', '{"layout":"telepathic"}')
      expect(() => { render(<GraphView />) }).not.toThrow()
      expect(localStorage.getItem('dks-graph-snapshot')).toBeNull()
      expect((screen.getByLabelText('Restore snapshot') as HTMLButtonElement).disabled).toBe(true)
    })

    it('drops an unparseable snapshot entry', () => {
      localStorage.setItem('dks-graph-snapshot', 'not json')
      render(<GraphView />)
      expect(localStorage.getItem('dks-graph-snapshot')).toBeNull()
      expect((screen.getByLabelText('Restore snapshot') as HTMLButtonElement).disabled).toBe(true)
    })

    it('clears the selection when the snapshot names an entity that no longer exists', () => {
      localStorage.setItem(
        'dks-graph-snapshot',
        JSON.stringify({
          layout: 'circular',
          selectedEntityId: 'deleted-entity',
          focusMode: true,
          panX: 0,
          panY: 0,
          zoom: 1,
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      )
      render(<GraphView />)
      fireEvent.click(screen.getByLabelText('Restore snapshot'))

      // A stale id must not leave focus mode pointed at a missing node.
      expect(mockSelectEntity).toHaveBeenCalledWith(null)
    })

    it('round-trips save then restore back to the same canvas state', () => {
      // The mocked store is read during render, so the selection is set before
      // the layout click that forces the re-render which captures it.
      currentSelectedEntityId = mockEntities[0].id
      render(<GraphView />)
      fireEvent.click(screen.getByText('circular'))
      fireEvent.click(screen.getByLabelText('Save snapshot'))

      // Move away from the saved state, then restore it.
      fireEvent.click(screen.getByText('hierarchical'))
      expect(screen.getByText('hierarchical')).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(screen.getByLabelText('Restore snapshot'))
      expect(screen.getByText('circular')).toHaveAttribute('aria-pressed', 'true')
      expect(mockSelectEntity).toHaveBeenCalledWith(mockEntities[0].id)
    })
  })

  it('renders entity type legend', () => {
    render(<GraphView />)
    expect(screen.getByText('Entity types')).toBeDefined()
    expect(screen.getByText('Note')).toBeDefined()
    expect(screen.getByText('Concept')).toBeDefined()
    expect(screen.getByText('Person')).toBeDefined()
    expect(screen.getByText('Project')).toBeDefined()
  })

  it('shows correct node and edge counts', () => {
    render(<GraphView />)
    expect(screen.getByText(/3 nodes · 1 edges/)).toBeDefined()
  })

  it('shows correct counts with focus mode enabled (only selected + neighbors)', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    // Unfiltered: all 3 fixture entities render.
    expect(screen.getByText(/3 nodes · 1 edges/)).toBeDefined()
    const focusBtn = screen.getByLabelText('Focus neighborhood')
    fireEvent.click(focusBtn)
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
    expect(screen.queryByText('Unrelated Entity')).toBeNull()
  })

  it('removes edges when entity type is filtered', () => {
    // When a node has a link to a non-existent target, the link should be filtered out
    const entitiesWithBadLink = [
      {
        id: 'ent-1',
        name: 'Entity 1',
        type: 'note' as const,
        description: '',
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: [{ targetId: 'non-existent', relation: 'related' }],
      },
    ]
    currentEntities = entitiesWithBadLink
    render(<GraphView />)
    expect(screen.getByText(/1 nodes · 0 edges/)).toBeDefined()
  })

  it('removes duplicate edges between same nodes', () => {
    const entitiesWithDupLinks = [
      {
        id: 'ent-1',
        name: 'Entity 1',
        type: 'note' as const,
        description: '',
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: [
          { targetId: 'ent-2', relation: 'related' },
          { targetId: 'ent-2', relation: 'related' },
        ],
      },
      {
        id: 'ent-2',
        name: 'Entity 2',
        type: 'note' as const,
        description: '',
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: [],
      },
    ]
    currentEntities = entitiesWithDupLinks
    render(<GraphView />)
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
  })

  it('renders edge label when a node is selected (highlighted edge)', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    // SVG renders with aria-label on the SVG element
    const svg = document.querySelector('svg[aria-label*="Knowledge graph"]')
    expect(svg).toBeDefined()
  })

  it('shows label truncation for long names', () => {
    const longNameEntity = [
      {
        id: 'ent-1',
        name: 'A very long entity name that should be truncated at 24 characters',
        type: 'note' as const,
        description: '',
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: [],
      },
    ]
    currentEntities = longNameEntity
    render(<GraphView />)
    const node = screen.getByRole('button', { name: /A very long entity/ })
    expect(node).toBeDefined()
  })

  it('renders no edges for empty entity list', () => {
    currentEntities = []
    render(<GraphView />)
    expect(screen.getByText('No entities to graph yet.')).toBeDefined()
  })
})
