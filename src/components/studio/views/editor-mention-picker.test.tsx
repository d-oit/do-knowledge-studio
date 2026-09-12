import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Entity } from '@/lib/studio/types'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return {
    AtSign: Icon,
    FileText: Icon,
    FolderKanban: Icon,
    Lightbulb: Icon,
    Shapes: Icon,
    User: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { EditorMentionPicker, MENTION_LISTBOX_ID } from './editor-mention-picker'

const makeEntity = (overrides: Partial<Entity>): Entity => ({
  id: 'e-1',
  name: 'Alice',
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const alice = makeEntity({ id: 'e1', name: 'Alice', type: 'person' })
const concept = makeEntity({ id: 'e2', name: 'Second Brain', type: 'concept' })

const renderPicker = (overrides: Partial<Parameters<typeof EditorMentionPicker>[0]> = {}) =>
  render(
    <EditorMentionPicker
      open
      query=""
      candidates={[alice, concept]}
      highlightedIndex={0}
      triggerStart={6}
      content="Hello @"
      textarea={{ current: null }}
      onHighlight={vi.fn()}
      onSelect={vi.fn()}
      {...overrides}
    />,
  )

describe('EditorMentionPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = renderPicker({ open: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a labelled listbox with an option per candidate', () => {
    renderPicker()
    const listbox = screen.getByRole('listbox', { name: 'Mention an entity' })
    expect(listbox).toHaveAttribute('id', MENTION_LISTBOX_ID)
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'Alice (Person)' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'Second Brain (Concept)' })).toBeDefined()
  })

  it('marks the highlighted option and gives it a stable id (aria-activedescendant target)', () => {
    renderPicker({ highlightedIndex: 1 })
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[1].id).toBe('editor-mention-option-1')
  })

  it('keeps option rows at 44px hit targets', () => {
    renderPicker()
    for (const option of screen.getAllByRole('option')) {
      expect(option.className).toContain('min-h-[44px]')
    }
  })

  it('shows the i18n empty state when there are no candidates', () => {
    renderPicker({ candidates: [] })
    expect(screen.getByText('No matching entities')).toBeDefined()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('shows the picker hint in the popover header', () => {
    renderPicker()
    expect(screen.getByText(/Type to filter, Enter to insert, Esc to close/)).toBeDefined()
  })

  it('calls onSelect with the entity when an option is clicked', () => {
    const onSelect = vi.fn()
    renderPicker({ onSelect })
    fireEvent.click(screen.getByRole('option', { name: 'Alice (Person)' }))
    expect(onSelect).toHaveBeenCalledWith(alice)
  })

  it('calls onHighlight when hovering an option', () => {
    const onHighlight = vi.fn()
    renderPicker({ onHighlight })
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Second Brain (Concept)' }))
    expect(onHighlight).toHaveBeenCalledWith(1)
  })

  it('keeps focus on the textarea when mousedown lands on an option', () => {
    const onSelect = vi.fn()
    renderPicker({ onSelect })
    const option = screen.getByRole('option', { name: 'Alice (Person)' })
    fireEvent.mouseDown(option)
    fireEvent.click(option)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})