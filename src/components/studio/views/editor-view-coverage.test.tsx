import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

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
  EditorToolbar: ({ onFormat, onVoiceTranscript }: { onFormat?: (cmd: string) => void; onVoiceTranscript?: (text: string) => void }) => (
    <div data-testid="editor-toolbar">
      <button data-testid="fmt-bold" onClick={() => onFormat?.('bold')}>Bold</button>
      <button data-testid="fmt-italic" onClick={() => onFormat?.('italic')}>Italic</button>
      <button data-testid="fmt-link" onClick={() => onFormat?.('link')}>Link</button>
      <button data-testid="fmt-h1" onClick={() => onFormat?.('h1')}>H1</button>
      <button data-testid="fmt-h2" onClick={() => onFormat?.('h2')}>H2</button>
      <button data-testid="fmt-bullet" onClick={() => onFormat?.('bullet')}>Bullet</button>
      <button data-testid="fmt-ordered" onClick={() => onFormat?.('ordered')}>Ordered</button>
      <button data-testid="fmt-quote" onClick={() => onFormat?.('quote')}>Quote</button>
      <button data-testid="fmt-code" onClick={() => onFormat?.('inlineCode')}>Code</button>
      <button data-testid="voice" onClick={() => onVoiceTranscript?.('transcribed text')}>Voice</button>
    </div>
  ),
}))

vi.mock('../remote-cursors', () => ({
  CursorTracker: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('./editor-claims-panel', () => ({
  ClaimsPanel: () => <div data-testid="claims-panel" />,
}))

vi.mock('./type-selector', () => ({
  TypeSelector: ({ onSelect, onToggleMenu, showMenu }: { onSelect?: (t: string) => void; onToggleMenu?: () => void; showMenu?: boolean }) => (
    <div data-testid="type-selector">
      {showMenu && <div data-testid="type-menu">Type Menu</div>}
      <button data-testid="toggle-type-menu" onClick={() => onToggleMenu?.()}>Toggle Type</button>
      <button data-testid="select-type-note" onClick={() => onSelect?.('note')}>Note</button>
      <button data-testid="select-type-concept" onClick={() => onSelect?.('concept')}>Concept</button>
    </div>
  ),
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
import * as editor from '@/lib/editor'

describe('EditorView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentEditingEntityId = null
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-entity-id')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders without errors', () => {
    render(<EditorView />)
    expect(screen.getByPlaceholderText('Entity name…')).toBeDefined()
  })

  it('hides source URL section by default', () => {
    render(<EditorView />)
    expect(screen.queryByLabelText('Source URL')).toBeNull()
  })

  it('adds a tag when add tag button is clicked', () => {
    render(<EditorView />)
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'newtag' } })
    const addBtn = screen.getByRole('button', { name: 'Add tag' })
    fireEvent.click(addBtn)
    expect(screen.getByText('#newtag')).toBeDefined()
  })

  it('adds a tag when Enter is pressed in tag input', () => {
    render(<EditorView />)
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'entertag' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('#entertag')).toBeDefined()
  })

  it('removes a tag when remove button is clicked', () => {
    render(<EditorView />)
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'removeme' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('#removeme')).toBeDefined()
    const removeBtn = screen.getByRole('button', { name: 'Remove tag removeme' })
    fireEvent.click(removeBtn)
    expect(screen.queryByText('#removeme')).toBeNull()
  })

  it('trims hash prefix from tag name', () => {
    render(<EditorView />)
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: '#hashtag' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('#hashtag')).toBeDefined()
  })

  it('does not add duplicate tags', () => {
    render(<EditorView />)
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'dupe' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'dupe' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Only one instance
    const tags = screen.getAllByText('#dupe')
    expect(tags.length).toBe(1)
  })

  it('disables save button when name is empty', () => {
    render(<EditorView />)
    const saveBtn = screen.getByText('Save to library')
    expect(saveBtn).toBeDisabled()
  })

  it('saves a new entity', () => {
    render(<EditorView />)
    const nameInput = screen.getByPlaceholderText('Entity name…')
    fireEvent.change(nameInput, { target: { value: 'New Entity' } })
    const saveBtn = screen.getByText('Save to library')
    fireEvent.click(saveBtn)
    expect(mockCommitEntity).toHaveBeenCalledTimes(1)
    expect(mockCommitEntity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-entity-id', name: 'New Entity' }),
    )
  })

  it('discards changes when discard is clicked for existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    const discardBtn = screen.getByText('Discard changes')
    fireEvent.click(discardBtn)
    expect(mockFinishEditing).toHaveBeenCalled()
  })

  it('applies bold formatting via toolbar button', () => {
    render(<EditorView />)
    const boldBtn = screen.getByTestId('fmt-bold')
    fireEvent.click(boldBtn)
    expect(editor.applyBold).toHaveBeenCalled()
  })

  it('applies italic formatting via toolbar button', () => {
    render(<EditorView />)
    const italicBtn = screen.getByTestId('fmt-italic')
    fireEvent.click(italicBtn)
    expect(editor.applyItalic).toHaveBeenCalled()
  })

  it('applies link formatting via toolbar button', () => {
    render(<EditorView />)
    const linkBtn = screen.getByTestId('fmt-link')
    fireEvent.click(linkBtn)
    expect(editor.applyLink).toHaveBeenCalled()
  })

  it('shows commit and discard buttons when editing existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    expect(screen.getByText('Commit changes')).toBeDefined()
    expect(screen.getByText('Discard changes')).toBeDefined()
  })

  it('shows save button for new entity', () => {
    render(<EditorView />)
    expect(screen.getByText('Save to library')).toBeDefined()
  })

  it('shows "Unsaved changes" indicator when content is dirty', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    const contentArea = screen.getByLabelText('Editor content')
    fireEvent.change(contentArea, { target: { value: 'Changed content' } })
    expect(screen.getByText('Unsaved changes')).toBeDefined()
  })

  it('shows "Draft saved" indicator when draft is saved and not dirty', async () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    // Wait for debounced draft save (500ms timeout)
    await waitFor(() => {
      expect(screen.getByText('Draft saved')).toBeDefined()
    })
  })

  it('does not show claims panel when creating new entity', () => {
    currentEditingEntityId = null
    render(<EditorView />)
    expect(screen.queryByTestId('claims-panel')).toBeNull()
  })

  it('shows claims panel when editing existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    expect(screen.getByTestId('claims-panel')).toBeDefined()
  })

  it('commits and removes draft on save of existing entity', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    const saveBtn = screen.getByText('Commit changes')
    fireEvent.click(saveBtn)
    expect(mockCommitEntity).toHaveBeenCalledTimes(1)
    expect(editor.removeDraft).toHaveBeenCalled()
  })

  it('removes draft on discard', () => {
    currentEditingEntityId = 'ent-1'
    render(<EditorView />)
    const discardBtn = screen.getByText('Discard changes')
    fireEvent.click(discardBtn)
    expect(editor.removeDraft).toHaveBeenCalled()
  })

  it('shows type menu when type selector toggle is clicked', () => {
    render(<EditorView />)
    const toggleBtn = screen.getByTestId('toggle-type-menu')
    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('type-menu')).toBeDefined()
  })

  it('switches type when type is selected from menu', () => {
    render(<EditorView />)
    const toggleBtn = screen.getByTestId('toggle-type-menu')
    fireEvent.click(toggleBtn)
    const noteBtn = screen.getByTestId('select-type-note')
    fireEvent.click(noteBtn)
    // After selecting, type menu closes
    expect(screen.queryByTestId('type-menu')).toBeNull()
  })

  it('shows add tag button when tag input has text', () => {
    render(<EditorView />)
    // Initially no Add tag button (input only)
    expect(screen.queryByRole('button', { name: 'Add tag' })).toBeNull()
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'test' } })
    // Now the + button should appear
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeDefined()
  })

  // Keyboard shortcuts — fire from the content textarea to pass the handler's target guard
  it('handles Ctrl+B keyboard shortcut for bold', () => {
    render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.keyDown(textarea, { key: 'b', ctrlKey: true })
    expect(editor.applyBold).toHaveBeenCalled()
  })

  it('handles Ctrl+I keyboard shortcut for italic', () => {
    render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.keyDown(textarea, { key: 'i', ctrlKey: true })
    expect(editor.applyItalic).toHaveBeenCalled()
  })

  it('handles Ctrl+K keyboard shortcut for link', () => {
    render(<EditorView />)
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.keyDown(textarea, { key: 'k', ctrlKey: true })
    expect(editor.applyLink).toHaveBeenCalled()
  })

  it('handles Ctrl+S keyboard shortcut for save', () => {
    render(<EditorView />)
    const nameInput = screen.getByPlaceholderText('Entity name…')
    fireEvent.change(nameInput, { target: { value: 'Saved Entity' } })
    const textarea = screen.getByLabelText('Editor content')
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true })
    expect(mockCommitEntity).toHaveBeenCalled()
  })
})
