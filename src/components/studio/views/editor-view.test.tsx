import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Save: Icon,
    X: Icon,
    Plus: Icon,
    ExternalLink: Icon,
    Tag: Icon,
    Bold: Icon,
    Italic: Icon,
    Heading1: Icon,
    Heading2: Icon,
    List: Icon,
    ListOrdered: Icon,
    Quote: Icon,
    Code: Icon,
    Link2: Icon,
    ChevronDown: Icon,
    Mic: Icon,
  }
})

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('@/lib/editor', () => ({
  applyBold: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'bold', selection: s.range })),
  applyItalic: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'italic', selection: s.range })),
  applyHeading: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'heading', selection: s.range })),
  applyBulletList: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'bullet', selection: s.range })),
  applyOrderedList: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'ordered', selection: s.range })),
  applyQuote: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'quote', selection: s.range })),
  applyInlineCode: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'code', selection: s.range })),
  applyLink: vi.fn((_c: string, s: { range: { start: number; end: number } }) => ({ text: 'link', selection: s.range })),
  generateDraftId: vi.fn(() => 'draft-test-id'),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(() => null),
  removeDraft: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./editor-toolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}))

vi.mock('../remote-cursors', () => ({
  CursorTracker: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('./editor-claims-panel', () => ({
  ClaimsPanel: () => <div data-testid="claims-panel" />,
}))

vi.mock('./type-selector', () => ({
  TypeSelector: () => <div data-testid="type-selector" />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockCommitEntity = vi.fn()
const mockFinishEditing = vi.fn()
const mockAddClaim = vi.fn()
const mockUpdateClaim = vi.fn()
const mockDeleteClaim = vi.fn()

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test Entity',
    type: 'concept' as const,
    description: 'A test concept',
    content: '# Hello',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

let currentEntities = mockEntities
let currentEditingEntityId: string | null = null

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: currentEntities,
      editingEntityId: currentEditingEntityId,
      commitEntity: mockCommitEntity,
      finishEditing: mockFinishEditing,
      claims: [],
      addClaim: mockAddClaim,
      updateClaim: mockUpdateClaim,
      deleteClaim: mockDeleteClaim,
    }),
}))

import { EditorView } from './editor-view'

describe('EditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentEditingEntityId = null
  })

  it('renders editor container with name input', () => {
    render(<EditorView />)
    expect(screen.getByPlaceholderText('Entity name…')).toBeDefined()
  })

  it('renders description textarea', () => {
    render(<EditorView />)
    expect(screen.getByPlaceholderText(/A short description/)).toBeDefined()
  })

  it('renders editor toolbar', () => {
    render(<EditorView />)
    expect(screen.getByTestId('editor-toolbar')).toBeDefined()
  })

  it('renders content textarea in edit mode', () => {
    render(<EditorView />)
    expect(screen.getByLabelText('Editor content')).toBeDefined()
  })

  it('renders edit mode toggle buttons', () => {
    render(<EditorView />)
    expect(screen.getByText('Edit')).toBeDefined()
    expect(screen.getByText('Preview')).toBeDefined()
    expect(screen.getByText('Split')).toBeDefined()
  })

  it('shows save button with correct label for new entity', () => {
    render(<EditorView />)
    expect(screen.getByText('Save to library')).toBeDefined()
  })

  it('shows commit button when editing existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    expect(screen.getByText('Commit changes')).toBeDefined()
  })

  it('shows discard button when editing existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    expect(screen.getByText('Discard changes')).toBeDefined()
  })

  it('shows word and char count in status bar', () => {
    render(<EditorView />)
    expect(screen.getByText(/words/)).toBeDefined()
    expect(screen.getByText(/chars/)).toBeDefined()
  })

  it('shows type selector', () => {
    render(<EditorView />)
    expect(screen.getByTestId('type-selector')).toBeDefined()
  })

  it('renders claims panel when editing existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    expect(screen.getByTestId('claims-panel')).toBeDefined()
  })

  it('does not render claims panel for new entity', () => {
    currentEditingEntityId = null
    render(<EditorView />)
    expect(screen.queryByTestId('claims-panel')).toBeNull()
  })
})
