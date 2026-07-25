import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, exit: _e, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    BrainCircuit: I,
    Plus: I,
    Trash2: I,
    Edit3: I,
    Undo2: I,
    Redo2: I,
    RefreshCw: I,
    Download: I,
    ChevronRight: I,
    ChevronDown: I,
    Sliders: I,
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
  Divider: () => <hr data-testid="divider" />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockSelectEntity = vi.fn()
const mockSetView = vi.fn()
const mockCommitEntity = vi.fn()
const mockDeleteEntity = vi.fn()
const mockStartEdit = vi.fn()
const mockUndo = vi.fn()
const mockRedo = vi.fn()

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Root Entity',
    type: 'concept' as const,
    description: 'root',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [{ targetId: 'ent-2', relation: 'contains' }],
  },
  {
    id: 'ent-2',
    name: 'Child Entity',
    type: 'note' as const,
    description: 'child',
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
      selectEntity: mockSelectEntity,
      setView: mockSetView,
      commitEntity: mockCommitEntity,
      deleteEntity: mockDeleteEntity,
      startEdit: mockStartEdit,
      undo: mockUndo,
      redo: mockRedo,
      entityHistory: [[]],
      historyIndex: 0,
    }),
}))

import { MindMapView } from './mindmap-view'

describe('MindMapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
  })

  it('renders mind map container', () => {
    render(<MindMapView />)
    expect(screen.getByRole('tree', { name: 'Knowledge mind map' })).toBeDefined()
  })

  it('renders toolbar with controls', () => {
    render(<MindMapView />)
    expect(screen.getByRole('toolbar', { name: 'Mind map controls' })).toBeDefined()
  })

  it('renders root entity selector', () => {
    render(<MindMapView />)
    expect(screen.getByLabelText('Root entity')).toBeDefined()
  })

  it('renders depth slider', () => {
    render(<MindMapView />)
    expect(screen.getByLabelText('Tree depth')).toBeDefined()
  })

  it('renders keyboard hint bar', () => {
    render(<MindMapView />)
    expect(screen.getByText(/add child/)).toBeDefined()
    expect(screen.getByText(/rename/)).toBeDefined()
    expect(screen.getByText(/delete/)).toBeDefined()
  })

  it('renders toolbar action buttons', () => {
    render(<MindMapView />)
    expect(screen.getByLabelText('Add child')).toBeDefined()
    expect(screen.getByLabelText('Rename')).toBeDefined()
    expect(screen.getByLabelText('Delete')).toBeDefined()
    expect(screen.getByLabelText('Undo')).toBeDefined()
    expect(screen.getByLabelText('Redo')).toBeDefined()
    expect(screen.getByLabelText('Sync')).toBeDefined()
    expect(screen.getByLabelText('Export PNG')).toBeDefined()
  })

  it('renders compact toggle', () => {
    render(<MindMapView />)
    expect(screen.getByText('Compact')).toBeDefined()
  })

  it('shows root entity in summary', () => {
    render(<MindMapView />)
    const matches = screen.getAllByText(/Root: Root Entity/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when no entities', () => {
    currentEntities = []
    render(<MindMapView />)
    expect(screen.getByText(/Add entities with links to build a mind map/)).toBeDefined()
    expect(screen.getByText('No data')).toBeDefined()
  })

  it('renders tree items for entities', () => {
    render(<MindMapView />)
    expect(screen.getByText('Root Entity')).toBeDefined()
    expect(screen.getByText('Child Entity')).toBeDefined()
  })
})
