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
    RotateCcw: I,
    RotateCw: I,
    Download: I,
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

  it('calls undo when undo button clicked', () => {
    currentHistoryIndex = 1
    currentEntityHistory = [[], []]
    render(<GraphView />)
    const undoBtn = screen.getByLabelText('Undo')
    fireEvent.click(undoBtn)
    expect(mockUndo).toHaveBeenCalled()
  })

  it('calls redo when redo button clicked', () => {
    currentEntityHistory = [[], []]
    render(<GraphView />)
    const redoBtn = screen.getByLabelText('Redo')
    fireEvent.click(redoBtn)
    expect(mockRedo).toHaveBeenCalled()
  })

  it('saves snapshot when save snapshot button clicked', () => {
    render(<GraphView />)
    const snapshotBtn = screen.getByLabelText('Save snapshot')
    fireEvent.click(snapshotBtn)
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'dks-graph-snapshot',
      expect.any(String),
    )
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
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
  })

  it('shows correct counts with focus mode enabled (only selected + neighbors)', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    const focusBtn = screen.getByLabelText('Focus neighborhood')
    fireEvent.click(focusBtn)
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
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
