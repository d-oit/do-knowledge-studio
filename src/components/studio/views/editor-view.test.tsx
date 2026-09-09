import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Entity } from '@/lib/studio/types'
import { buildMentionToken } from '@/lib/editor/mention'

vi.mock('framer-motion', () => ({
  motion: {
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
    Save: Icon,
    X: Icon,
    Plus: Icon,
    ExternalLink: Icon,
    Tag: Icon,
    AtSign: Icon,
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
  CursorTracker: ({ children }: { children?: ReactNode }) => children,
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
const mockSaveEntity = vi.fn()
const mockFinishEditing = vi.fn()
const mockNavigateToView = vi.fn()
const mockAddClaim = vi.fn()
const mockUpdateClaim = vi.fn()
const mockDeleteClaim = vi.fn()

const mockEntities: Entity[] = [
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
  {
    id: 'ent-2',
    name: 'Alice Entity',
    type: 'person' as const,
    description: 'Mention target',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
  {
    id: 'ent-3',
    name: 'Bob Entity',
    type: 'note' as const,
    description: 'Second mention target',
    content: '',
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
      saveEntity: mockSaveEntity,
      finishEditing: mockFinishEditing,
      navigateToView: mockNavigateToView,
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

describe('EditorView @mention linking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentEditingEntityId = 'ent-1'
  })

  const openPicker = async (text = 'Hello @Ali', caret = text.length) => {
    render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.change(textarea, { target: { value: text, selectionStart: caret, selectionEnd: caret } })
    await screen.findByRole('listbox', { name: 'Mention an entity' })
    return textarea
  }

  it('opens the mention listbox on @ and filters case-insensitively by name', async () => {
    const textarea = await openPicker('Hello @ali', 10)
    expect(textarea).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'Alice Entity (Person)' })).toBeDefined()
    // 'Bob Entity' does not match the query, and the editing entity is excluded.
    expect(screen.queryByRole('option', { name: 'Bob Entity (Note)' })).toBeNull()
    expect(screen.queryByRole('option', { name: /Test Entity/ })).toBeNull()
  })

  it('shows an initial list for a bare @', async () => {
    await openPicker('Hello @', 7)
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('inserts the mention token on option click', async () => {
    const textarea = await openPicker()
    fireEvent.click(screen.getByRole('option', { name: 'Alice Entity (Person)' }))
    expect(textarea).toHaveValue(`Hello ${buildMentionToken('ent-2', 'Alice Entity')}`)
    // Picker closes after insertion.
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('moves the highlight with Arrow keys and inserts with Enter', async () => {
    const textarea = await openPicker('Hello @', 7)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    // Empty query + one ArrowDown on a 2-item list wraps... no: ArrowDown once → item 1.
    expect(textarea).toHaveValue(`Hello ${buildMentionToken('ent-3', 'Bob Entity')}`)
  })

  it('closes on Escape and reopens only for a NEW @ context', async () => {
    const textarea = await openPicker('Hello @Ali', 10)
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    // Continuing the same trigger stays closed…
    fireEvent.change(textarea, { target: { value: 'Hello @Alic', selectionStart: 11, selectionEnd: 11 } })
    expect(screen.queryByRole('listbox')).toBeNull()
    // …a new @ reopens.
    fireEvent.change(textarea, { target: { value: 'Hello @Alic @', selectionStart: 13, selectionEnd: 13 } })
    await screen.findByRole('listbox', { name: 'Mention an entity' })
  })

  it('derives mention links and writes reciprocal backlinks on save', async () => {
        render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    const value = `See ${buildMentionToken('ent-2', 'Alice Entity')}`
    fireEvent.change(textarea, { target: { value, selectionStart: value.length, selectionEnd: value.length } })
    fireEvent.click(screen.getByText('Commit changes'))

    const saved = mockCommitEntity.mock.calls[0][0]
    expect(saved.id).toBe('ent-1')
    expect(saved.links).toContainEqual({ targetId: 'ent-2', relation: 'mentions' })

    // Reciprocal backlink written via the navigation-free commitEntity
    // (backlink revocation must not navigate away from the editor).
    expect(mockCommitEntity).toHaveBeenCalledTimes(2)
    const backlinked = mockCommitEntity.mock.calls[1][0]
    expect(backlinked.id).toBe('ent-2')
    expect(backlinked.links).toContainEqual({ targetId: 'ent-1', relation: 'mentioned-in' })
    // The entity mentions someone → save finishes editing and lands on library.
    expect(mockFinishEditing).toHaveBeenCalledTimes(1)
    expect(mockNavigateToView).toHaveBeenCalledWith('library')
  })

  it('does not write a mention link when the token text was removed before saving', async () => {
        render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.change(textarea, { target: { value: 'Mentions were removed', selectionStart: 21, selectionEnd: 21 } })
    fireEvent.click(screen.getByText('Commit changes'))

    const saved = mockCommitEntity.mock.calls[0][0]
    expect(saved.links.filter((l: { relation: string }) => l.relation === 'mentions')).toHaveLength(0)
    // No targets mentioned → no backlink writes, no navigation.
    expect(mockCommitEntity).toHaveBeenCalledTimes(1)
    expect(mockNavigateToView).not.toHaveBeenCalled()
  })

  it('revokes stale backlinks when a previously mentioned entity is no longer mentioned', async () => {
    currentEntities = mockEntities.map((e) =>
      e.id === 'ent-2'
        ? { ...e, links: [{ targetId: 'ent-1', relation: 'mentioned-in' as const }] }
        : e,
    )
        render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.change(textarea, { target: { value: 'No mentions now', selectionStart: 15, selectionEnd: 15 } })
    fireEvent.click(screen.getByText('Commit changes'))

    expect(mockCommitEntity).toHaveBeenCalledTimes(2)
    const updated = mockCommitEntity.mock.calls[1][0]
    expect(updated.id).toBe('ent-2')
    expect(updated.links).toEqual([])
  })
})