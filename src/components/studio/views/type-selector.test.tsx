import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    ChevronDown: I,
    FileText: I,
    Lightbulb: I,
    User: I,
    FolderKanban: I,
    Shapes: I,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

/** Mutable mock of the entity-type registry (module-level, shared per test file). */
const { mockDefs, mockMeta } = vi.hoisted(() => ({
  mockDefs: [
    { id: 'note', label: 'Note', color: 'sky', bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
    { id: 'concept', label: 'Concept', color: 'saffron', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-600' },
    { id: 'person', label: 'Person', color: 'clay', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
    { id: 'project', label: 'Project', color: 'sage', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-600' },
  ],
  mockMeta: (t: string) => {
    const def = mockDefs.find((d) => d.id === t)
    return def ? { label: def.label, bg: def.bg, text: def.text, dot: def.dot } : { label: t, bg: '', text: '', dot: '' }
  },
}))

vi.mock('@/lib/studio/entity-types', () => ({
  getEntityTypeDefs: () => mockDefs,
  getEntityTypeMeta: (t: string) => mockMeta(t),
}))

const mockOnToggleMenu = vi.fn()
const mockOnSelect = vi.fn()

import { TypeSelector } from './type-selector'

describe('TypeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the current type label', () => {
    render(<TypeSelector type="note" showMenu={false} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    expect(screen.getByText('Type: Note')).toBeDefined()
  })

  it('renders concept type label', () => {
    render(<TypeSelector type="concept" showMenu={false} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    expect(screen.getByText('Type: Concept')).toBeDefined()
  })

  it('calls onToggleMenu when button is clicked', () => {
    render(<TypeSelector type="note" showMenu={false} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(mockOnToggleMenu).toHaveBeenCalledTimes(1)
  })

  it('does not render the menu when showMenu is false', () => {
    render(<TypeSelector type="note" showMenu={false} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('renders the menu when showMenu is true', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    expect(screen.getByRole('listbox')).toBeDefined()
  })

  it('renders all four built-in entity type options', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(screen.getByRole('option', { name: /Note/ })).toBeDefined()
    expect(screen.getByRole('option', { name: /Concept/ })).toBeDefined()
    expect(screen.getByRole('option', { name: /Person/ })).toBeDefined()
    expect(screen.getByRole('option', { name: /Project/ })).toBeDefined()
  })

  it('renders registered custom types as options', () => {
    mockDefs.push({ id: 'roadmap', label: 'Roadmap', color: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' })
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(screen.getByRole('option', { name: /Roadmap/ })).toBeDefined()
    mockDefs.pop()
  })

  it('marks the current type as aria-selected', () => {
    render(<TypeSelector type="concept" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const conceptOption = screen.getByRole('option', { name: /Concept/ })
    expect(conceptOption.getAttribute('aria-selected')).toBe('true')
    const noteOption = screen.getByRole('option', { name: /Note/ })
    expect(noteOption.getAttribute('aria-selected')).toBe('false')
  })

  it('calls onSelect when an option is clicked', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByRole('option', { name: /Person/ }))
    expect(mockOnSelect).toHaveBeenCalledWith('person')
  })

  it('calls onSelect with a custom type id when clicked', () => {
    mockDefs.push({ id: 'roadmap', label: 'Roadmap', color: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' })
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByRole('option', { name: /Roadmap/ }))
    expect(mockOnSelect).toHaveBeenCalledWith('roadmap')
    mockDefs.pop()
  })

  it('sets aria-haspopup and aria-expanded on the trigger button', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-haspopup')).toBe('listbox')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('aria-expanded is false when menu is closed', () => {
    render(<TypeSelector type="note" showMenu={false} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes menu on Escape key', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(mockOnToggleMenu).toHaveBeenCalledTimes(1)
  })

  it('moves focus with ArrowDown', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const listbox = screen.getByRole('listbox')
    const options = screen.getAllByRole('option')
    options[0].focus()
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options[1])
  })

  it('moves focus with ArrowUp wrapping around', () => {
    render(<TypeSelector type="note" showMenu={true} onToggleMenu={mockOnToggleMenu} onSelect={mockOnSelect} />)
    const listbox = screen.getByRole('listbox')
    const options = screen.getAllByRole('option')
    options[0].focus()
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(options[options.length - 1])
  })
})