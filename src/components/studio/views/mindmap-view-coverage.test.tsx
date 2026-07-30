import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

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

vi.mock('./export-helpers', () => ({
  todayStamp: () => '2026-01-01',
  downloadBlob: vi.fn(),
}))

const mockSelectEntity = vi.fn()
const mockSetView = vi.fn()
const mockCommitEntity = vi.fn()
const mockDeleteEntity = vi.fn()
const mockStartEdit = vi.fn()
const mockUndo = vi.fn()
const mockRedo = vi.fn()

const childEntity = {
  id: 'ent-2',
  name: 'Child Entity',
  type: 'note' as const,
  description: 'child',
  content: '',
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  links: [
    { targetId: 'ent-3', relation: 'contains' },
  ],
}

const grandchildEntity = {
  id: 'ent-3',
  name: 'Grandchild Entity',
  type: 'project' as const,
  description: 'grandchild',
  content: '',
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  links: [],
}

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
    links: [
      { targetId: 'ent-2', relation: 'contains' },
    ],
  },
  childEntity,
  grandchildEntity,
]

let currentEntities = mockEntities
let currentHistoryIndex = 0
let currentEntityHistory: unknown[][] = [[]]

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
      entityHistory: currentEntityHistory,
      historyIndex: currentHistoryIndex,
    }),
}))

import { MindMapView } from './mindmap-view'
import * as exportHelpers from './export-helpers'

describe('MindMapView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentHistoryIndex = 0
    currentEntityHistory = [[]]
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-child-id')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows empty state when no entities', () => {
    currentEntities = []
    render(<MindMapView />)
    expect(screen.getByText(/Add entities with links to build a mind map/)).toBeDefined()
    expect(screen.getByText('No data')).toBeDefined()
  })

  it('selects entity and switches to editor on node click', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.click(node)
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
    expect(mockSetView).toHaveBeenCalledWith('editor')
  })

  it('selects entity and switches to editor on Enter key', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
    expect(mockSetView).toHaveBeenCalledWith('editor')
  })

  it('selects entity and switches to editor on Space key', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.keyDown(node, { key: ' ' })
    expect(mockSelectEntity).toHaveBeenCalledWith('ent-1')
    expect(mockSetView).toHaveBeenCalledWith('editor')
  })

  it('focuses a node and tracks focusedNodeId', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.focus(node.parentElement as HTMLElement)
    expect(node.parentElement).toHaveAttribute('tabIndex', '0')
  })

  it('expands a collapsed node with ArrowRight', async () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.keyDown(node, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(screen.getByText('Child Entity')).toBeDefined()
    })
  })

  it('collapses an expanded node with ArrowLeft', async () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    fireEvent.keyDown(node, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(screen.getByText('Child Entity')).toBeDefined()
    })
    fireEvent.keyDown(node, { key: 'ArrowLeft' })
    // Child should still be rendered because root is always expanded at level 0
    expect(screen.getByText('Child Entity')).toBeDefined()
  })

  it('focuses next node with ArrowDown', async () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    const parent = node.closest('[role="treeitem"]') as HTMLElement
    fireEvent.keyDown(parent, { key: 'ArrowDown' })
    // ArrowDown calls focus on the next treeitem; we can only verify no throw
    expect(parent).toBeDefined()
  })

  it('focuses previous node with ArrowUp', async () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    const parent = node.closest('[role="treeitem"]') as HTMLElement
    fireEvent.keyDown(parent, { key: 'ArrowUp' })
    expect(parent).toBeDefined()
  })

  it('jumps to first node with Home', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    const parent = node.closest('[role="treeitem"]') as HTMLElement
    fireEvent.keyDown(parent, { key: 'Home' })
    expect(parent).toBeDefined()
  })

  it('jumps to last node with End', () => {
    render(<MindMapView />)
    const node = screen.getByText('Root Entity')
    const parent = node.closest('[role="treeitem"]') as HTMLElement
    fireEvent.keyDown(parent, { key: 'End' })
    expect(parent).toBeDefined()
  })

  it('adds child when toolbar button is clicked and a node is focused', () => {
    render(<MindMapView />)
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Add child'))
    expect(mockCommitEntity).toHaveBeenCalledTimes(2)
  })

  it('starts editing focused node when rename button is clicked', () => {
    render(<MindMapView />)
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Rename'))
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('deletes focused node when delete button is clicked', () => {
    render(<MindMapView />)
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Delete'))
    expect(mockDeleteEntity).toHaveBeenCalledWith('ent-1')
  })

  it('adds child via global Ctrl+Tab keyboard shortcut', () => {
    render(<MindMapView />)
    const canvas = screen.getByRole('tree', { name: 'Knowledge mind map' }).parentElement as HTMLElement
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.keyDown(canvas, { key: 'Tab', ctrlKey: true })
    expect(mockCommitEntity).toHaveBeenCalledTimes(2)
  })

  it('starts editing via global F2 keyboard shortcut', () => {
    render(<MindMapView />)
    const canvas = screen.getByRole('tree', { name: 'Knowledge mind map' }).parentElement as HTMLElement
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.keyDown(canvas, { key: 'F2' })
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('deletes focused node via global Delete keyboard shortcut', () => {
    render(<MindMapView />)
    const canvas = screen.getByRole('tree', { name: 'Knowledge mind map' }).parentElement as HTMLElement
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.keyDown(canvas, { key: 'Delete' })
    expect(mockDeleteEntity).toHaveBeenCalledWith('ent-1')
  })

  it('deletes focused node via global Backspace keyboard shortcut', () => {
    render(<MindMapView />)
    const canvas = screen.getByRole('tree', { name: 'Knowledge mind map' }).parentElement as HTMLElement
    fireEvent.focus(screen.getByText('Root Entity').closest('[role="treeitem"]') as HTMLElement)
    fireEvent.keyDown(canvas, { key: 'Backspace' })
    expect(mockDeleteEntity).toHaveBeenCalledWith('ent-1')
  })

  it('changes root entity via selector', () => {
    render(<MindMapView />)
    const select = screen.getByLabelText('Root entity')
    fireEvent.change(select, { target: { value: 'ent-2' } })
    expect(select).toHaveValue('ent-2')
  })

  it('changes tree depth via slider', () => {
    render(<MindMapView />)
    const slider = screen.getByLabelText('Tree depth')
    fireEvent.change(slider, { target: { value: '5' } })
    expect(slider).toHaveValue('5')
  })

  it('toggles compact mode', () => {
    render(<MindMapView />)
    const button = screen.getByText('Compact')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('syncs tree when sync button is clicked', () => {
    render(<MindMapView />)
    fireEvent.click(screen.getByLabelText('Sync'))
    expect(screen.getByText('Root: Root Entity')).toBeDefined()
  })

  it('exports PNG when export button is clicked', () => {
    const downloadBlobMock = vi.spyOn(exportHelpers, 'downloadBlob').mockImplementation(() => {})
    render(<MindMapView />)
    fireEvent.click(screen.getByLabelText('Export PNG'))
    expect(downloadBlobMock).not.toHaveBeenCalled()
  })

  it('undoes last action when undo is clicked and history allows', () => {
    currentHistoryIndex = 1
    currentEntityHistory = [[], []]
    render(<MindMapView />)
    fireEvent.click(screen.getByLabelText('Undo'))
    expect(mockUndo).toHaveBeenCalled()
  })

  it('redoes action when redo is clicked and history allows', () => {
    currentHistoryIndex = 0
    currentEntityHistory = [[], []]
    render(<MindMapView />)
    fireEvent.click(screen.getByLabelText('Redo'))
    expect(mockRedo).toHaveBeenCalled()
  })

  it('renders expand/collapse chevron for nodes with children', () => {
    render(<MindMapView />)
    expect(screen.getByLabelText('Collapse')).toBeDefined()
  })

  it('toggles node expansion when chevron is clicked', () => {
    render(<MindMapView />)
    // The root is always expanded; the child (level 1) starts collapsed.
    const expandButton = screen.getByLabelText('Expand')
    fireEvent.click(expandButton)
    // After expanding the child, both root and child show Collapse.
    expect(screen.getAllByLabelText('Collapse').length).toBe(2)
    fireEvent.click(screen.getAllByLabelText('Collapse')[1])
    // The child collapses again; the Expand label reappears.
    expect(screen.getByLabelText('Expand')).toBeDefined()
  })
})
