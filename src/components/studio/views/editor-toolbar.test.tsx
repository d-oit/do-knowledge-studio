import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Bold: I,
    Italic: I,
    Heading1: I,
    Heading2: I,
    List: I,
    ListOrdered: I,
    Quote: I,
    Code: I,
    Link2: I,
    ChevronDown: I,
  }
})

vi.mock('../ui/shared-primitives', () => ({
  Divider: () => <span data-testid="divider" />,
}))

vi.mock('../voice-input', () => ({
  VoiceInput: ({ onTranscript }: { onTranscript: (text: string) => void }) => (
    <button data-testid="voice-input" onClick={() => onTranscript('voice text')}>
      Voice
    </button>
  ),
}))

const mockOnToggleAdvanced = vi.fn()
const mockOnFormat = vi.fn()
const mockOnVoiceTranscript = vi.fn()

import { EditorToolbar } from './editor-toolbar'

describe('EditorToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the toolbar with aria-label', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeDefined()
  })

  it('renders all formatting buttons', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Bullet list' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Quote' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Code' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Insert link' })).toBeDefined()
  })

  it('calls onFormat with bold when Bold button is clicked', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(mockOnFormat).toHaveBeenCalledWith('bold')
  })

  it('calls onFormat with correct commands for each button', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    const commands: Array<[string, string]> = [
      ['Bold', 'bold'],
      ['Italic', 'italic'],
      ['Heading 1', 'h1'],
      ['Heading 2', 'h2'],
      ['Bullet list', 'bullet'],
      ['Numbered list', 'ordered'],
      ['Quote', 'quote'],
      ['Code', 'code'],
      ['Insert link', 'link'],
    ]
    for (const [label, cmd] of commands) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(mockOnFormat).toHaveBeenCalledWith(cmd)
    }
    expect(mockOnFormat).toHaveBeenCalledTimes(commands.length)
  })

  it('renders Advanced toggle button', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.getByRole('button', { name: /Advanced/ })).toBeDefined()
  })

  it('calls onToggleAdvanced when Advanced button is clicked', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    expect(mockOnToggleAdvanced).toHaveBeenCalledTimes(1)
  })

  it('shows advanced label when showAdvanced is false', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.getByText('Source URL, tags')).toBeDefined()
  })

  it('hides advanced label when showAdvanced is true', () => {
    render(
      <EditorToolbar
        showAdvanced={true}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.queryByText('Source URL, tags')).toBeNull()
  })

  it('shows VoiceInput when onVoiceTranscript is provided', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
        onVoiceTranscript={mockOnVoiceTranscript}
      />,
    )
    expect(screen.getByTestId('voice-input')).toBeDefined()
  })

  it('hides VoiceInput when onVoiceTranscript is not provided', () => {
    render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.queryByTestId('voice-input')).toBeNull()
  })

  it('sets aria-expanded on Advanced button based on showAdvanced', () => {
    const { rerender } = render(
      <EditorToolbar
        showAdvanced={false}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    const advButton = screen.getByRole('button', { name: /Advanced/ })
    expect(advButton.getAttribute('aria-expanded')).toBe('false')
    rerender(
      <EditorToolbar
        showAdvanced={true}
        onToggleAdvanced={mockOnToggleAdvanced}
        onFormat={mockOnFormat}
      />,
    )
    expect(screen.getByRole('button', { name: /Advanced/ }).getAttribute('aria-expanded')).toBe('true')
  })
})
