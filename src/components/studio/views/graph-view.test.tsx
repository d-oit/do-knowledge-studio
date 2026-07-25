import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

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

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: currentEntities,
      selectedEntityId: null,
      selectEntity: mockSelectEntity,
      undo: mockUndo,
      redo: mockRedo,
      entityHistory: [[]],
      historyIndex: 0,
    }),
}))

import { GraphView } from './graph-view'

describe('GraphView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
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

  it('renders undo and redo buttons', () => {
    render(<GraphView />)
    expect(screen.getByLabelText('Undo')).toBeDefined()
    expect(screen.getByLabelText('Redo')).toBeDefined()
  })

  it('renders export PNG button', () => {
    render(<GraphView />)
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
})
