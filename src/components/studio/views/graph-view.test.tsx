import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

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

const mocks = vi.hoisted(() => ({
  selectEntity: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  deleteEntity: vi.fn(),
}))

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

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        entities: currentEntities,
        selectedEntityId: currentSelectedEntityId,
        selectEntity: mocks.selectEntity,
        undo: mocks.undo,
        redo: mocks.redo,
        deleteEntity: mocks.deleteEntity,
        entityHistory: [[]],
        historyIndex: 0,
      }),
    {
      getState: () => ({
        deleteEntity: mocks.deleteEntity,
      }),
    },
  ),
}))

import { GraphView } from './graph-view'

describe('GraphView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentSelectedEntityId = null
  })

  it('renders graph container with SVG', () => {
    render(<GraphView />)
    const svg = screen.getByRole('img', { name: /knowledge graph/i })
    expect(svg).toBeDefined()
  })

  it('renders layout toolbar buttons', () => {
    render(<GraphView />)
    expect(screen.getByText('force')).toBeDefined()
    expect(screen.getByText('circular')).toBeDefined()
    expect(screen.getByText('hierarchical')).toBeDefined()
  })

  it('renders focus neighborhood button', () => {
    render(<GraphView />)
    expect(screen.getByLabelText('Focus neighborhood')).toBeDefined()
  })

  it('renders undo and redo buttons behind More controls', () => {
    render(<GraphView />)
    fireEvent.click(screen.getByLabelText('More controls'))
    expect(screen.getByLabelText('Undo')).toBeDefined()
    expect(screen.getByLabelText('Redo')).toBeDefined()
  })

  it('renders export PNG button behind More controls', () => {
    render(<GraphView />)
    fireEvent.click(screen.getByLabelText('More controls'))
    expect(screen.getByLabelText('Export PNG')).toBeDefined()
  })

  it('shows node and edge count', () => {
    render(<GraphView />)
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
  })

  it('renders entity type legend', () => {
    render(<GraphView />)
    expect(screen.getByText('Entity types')).toBeDefined()
  })

  it('handles empty entity list with overlay', () => {
    currentEntities = []
    render(<GraphView />)
    expect(screen.getByText('No entities to graph yet.')).toBeDefined()
  })

  it('renders graph toolbar', () => {
    render(<GraphView />)
    expect(screen.getByRole('toolbar', { name: 'Graph controls' })).toBeDefined()
  })

  it('renders save snapshot button', () => {
    render(<GraphView />)
    expect(screen.getByLabelText('Save snapshot')).toBeDefined()
  })

  it('toggles More controls disclosure', () => {
    render(<GraphView />)
    const more = screen.getByLabelText('More controls')
    expect(screen.queryByLabelText('Export PNG')).toBeNull()
    fireEvent.click(more)
    expect(screen.getByLabelText('Export PNG')).toBeDefined()
    fireEvent.click(more)
    expect(screen.queryByLabelText('Export PNG')).toBeNull()
  })

  it('graph container is keyboard focusable with role application', () => {
    render(<GraphView />)
    const container = screen.getByRole('application', { name: /graph canvas/i })
    expect(container).toBeDefined()
    expect(container).toHaveAttribute('tabIndex', '0')
  })

  it('arrow keys pan the graph viewBox', () => {
    render(<GraphView />)
    const container = screen.getByRole('application', { name: /graph canvas/i })
    const svg = screen.getByRole('img', { name: /knowledge graph/i })
    const initialViewBox = svg.getAttribute('viewBox')
    fireEvent.keyDown(container, { key: 'ArrowRight' })
    const afterViewBox = svg.getAttribute('viewBox')
    expect(afterViewBox).not.toBe(initialViewBox)
  })

  it('Home key resets pan and zoom', () => {
    render(<GraphView />)
    const container = screen.getByRole('application', { name: /graph canvas/i })
    const svg = screen.getByRole('img', { name: /knowledge graph/i })
    // Pan first
    fireEvent.keyDown(container, { key: 'ArrowRight' })
    const pannedViewBox = svg.getAttribute('viewBox')
    // Reset with Home
    fireEvent.keyDown(container, { key: 'Home' })
    const resetViewBox = svg.getAttribute('viewBox')
    expect(resetViewBox).not.toBe(pannedViewBox)
  })

  it('Delete key calls deleteEntity when entity is selected', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)
    const container = screen.getByRole('application', { name: /graph canvas/i })
    fireEvent.keyDown(container, { key: 'Delete' })
    expect(mocks.deleteEntity).toHaveBeenCalledWith('ent-1')
  })

  it('Delete key does nothing when no entity is selected', () => {
    currentSelectedEntityId = null
    render(<GraphView />)
    const container = screen.getByRole('application', { name: /graph canvas/i })
    fireEvent.keyDown(container, { key: 'Delete' })
    expect(mocks.deleteEntity).not.toHaveBeenCalled()
  })

  it('renders relation label with perpendicular offset and background stroke when an entity is selected', () => {
    currentSelectedEntityId = 'ent-1'
    render(<GraphView />)

    const label = screen.getByText('related')
    expect(label).toBeDefined()
    expect(label.tagName).toBe('text')
    expect(label).toHaveAttribute('stroke', 'var(--background)')
    expect(label).toHaveAttribute('stroke-width', '4')
    expect(label).toHaveAttribute('paint-order', 'stroke fill')

    const x = parseFloat(label.getAttribute('x') || '0')
    const y = parseFloat(label.getAttribute('y') || '0')
    expect(x).not.toBeNaN()
    expect(y).not.toBeNaN()
  })
})
