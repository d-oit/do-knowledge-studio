import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  WelcomePanel,
  MessageList,
  SuggestionsBar,
  InputBar,
} from './chat-view'
import type { ChatMessage } from '@/lib/studio/types'

vi.mock('framer-motion', async () => (await import('@/test/chat-mocks')).framerMotionMock)
vi.mock('lucide-react', async () => (await import('@/test/chat-mocks')).lucideIconsMock)
vi.mock('react-markdown', async () => (await import('@/test/chat-mocks')).markdownMock)
vi.mock('@/lib/utils', async () => (await import('@/test/chat-mocks')).cnMock)
vi.mock('../voice-input', async () => (await import('@/test/chat-mocks')).voiceInputMock)

const userMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'u1',
  role: 'user',
  content: 'Hello',
  timestamp: '2026-08-14T00:00:00.000Z',
  ...overrides,
})

const assistantMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'a1',
  role: 'assistant',
  content: 'Hi there',
  timestamp: '2026-08-14T00:00:00.000Z',
  ...overrides,
})

/** The prompt chips both WelcomePanel and SuggestionsBar render. Keeping the
 * expected (label, query) pairs here locks the keyboard-visible contract: every
 * chip must expose its label as the accessible name and dispatch the full query. */
const EXPECTED_SUGGESTIONS = [
  { label: 'Summarize recent projects', query: 'Give me a summary of the projects in my library.' },
  { label: 'Key people', query: 'Who are the key people in my knowledge base?' },
  { label: 'What is TRIZ useful for?', query: 'What is the TRIZ contradiction matrix useful for?' },
]

describe('WelcomePanel', () => {
  it('renders capability and suggestion copy', () => {
    render(<WelcomePanel reducedMotion={false} onSend={vi.fn()} />)
    expect(screen.getByText('Ask your library')).toBeDefined()
    expect(screen.getByText('What you can ask')).toBeDefined()
    expect(screen.getAllByText('Summarize recent projects').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSend with the suggestion query on click', () => {
    const onSend = vi.fn()
    render(<WelcomePanel reducedMotion={false} onSend={onSend} />)
    fireEvent.click(screen.getAllByText('Key people')[0])
    expect(onSend).toHaveBeenCalledWith('Who are the key people in my knowledge base?')
  })

  it.each(EXPECTED_SUGGESTIONS)('chip "$label" exposes its label as the accessible name and sends the full query', ({ label, query }) => {
    const onSend = vi.fn()
    render(<WelcomePanel reducedMotion={false} onSend={onSend} />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onSend).toHaveBeenCalledWith(query)
  })

  it('renders suggestion chips as native focusable buttons (keyboard activatable via Enter/Space)', () => {
    render(<WelcomePanel reducedMotion={false} onSend={vi.fn()} />)
    const chips = screen.getAllByRole('button')
    expect(chips.length).toBe(EXPECTED_SUGGESTIONS.length)
    chips.forEach((chip) => {
      expect(chip.tagName).toBe('BUTTON')
      expect(chip).not.toBeDisabled()
      expect(chip.tabIndex).toBe(0)
      expect(chip.className).toContain('min-h-[44px]')
    })
  })
})

describe('MessageList', () => {
  const baseProps = {
    reducedMotion: false,
    showCitations: null,
    onToggleCitations: vi.fn(),
    onCitationClick: vi.fn(),
  }

  it('renders user and assistant message content', () => {
    render(<MessageList chat={[userMsg(), assistantMsg()]} {...baseProps} />)
    expect(screen.getByText('Hello')).toBeDefined()
    expect(screen.getByText('Hi there')).toBeDefined()
  })

  it('announces sender roles via sr-only labels', () => {
    render(<MessageList chat={[userMsg(), assistantMsg()]} {...baseProps} />)
    const you = screen.getByText(/^You:$/)
    const assistant = screen.getByText(/^Assistant:$/)
    expect(you.className).toContain('sr-only')
    expect(assistant.className).toContain('sr-only')
  })

  it('renders assistant content through Markdown', () => {
    render(<MessageList chat={[assistantMsg({ content: '**bold**' })]} {...baseProps} />)
    expect(screen.getByTestId('markdown')).toBeDefined()
  })

  it('toggles citations via onToggleCitations', () => {
    const onToggleCitations = vi.fn()
    const msg = assistantMsg({
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    render(
      <MessageList
        chat={[msg]}
        {...baseProps}
        onToggleCitations={onToggleCitations}
      />,
    )
    const toggle = screen.getByRole('button', { name: /Used 1 local item/ })
    fireEvent.click(toggle)
    expect(onToggleCitations).toHaveBeenCalledWith('a1')
  })

  it('reflects the expanded citation state via aria-expanded', () => {
    const msg = assistantMsg({
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    const { rerender } = render(<MessageList chat={[msg]} {...baseProps} showCitations="a1" />)
    expect(screen.getByRole('button', { name: /Used 1 local item/ })).toHaveAttribute('aria-expanded', 'true')
    rerender(<MessageList chat={[msg]} {...baseProps} showCitations={null} />)
    expect(screen.getByRole('button', { name: /Used 1 local item/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens a cited entity via onCitationClick', () => {
    const onCitationClick = vi.fn()
    const msg = assistantMsg({
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    render(
      <MessageList
        chat={[msg]}
        {...baseProps}
        showCitations="a1"
        onCitationClick={onCitationClick}
      />,
    )
    fireEvent.click(screen.getByText('Entity One'))
    expect(onCitationClick).toHaveBeenCalledWith('e1')
  })

  it('closes the expanded citation panel on Escape and returns focus to the toggle', () => {
    const onToggleCitations = vi.fn()
    const msg = assistantMsg({
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    render(
      <MessageList
        chat={[msg]}
        {...baseProps}
        showCitations="a1"
        onToggleCitations={onToggleCitations}
      />,
    )
    const toggle = screen.getByRole('button', { name: /Used 1 local item/ })
    // Keyboard users can land focus on a citation button inside the panel;
    // Escape must close the panel no matter which element in the message has focus.
    fireEvent.keyDown(screen.getByRole('button', { name: /^1 Entity One/ }), { key: 'Escape' })
    expect(onToggleCitations).toHaveBeenCalledWith('a1')
    expect(toggle).toHaveFocus()
  })

  it('ignores Escape while the citation panel is closed', () => {
    const onToggleCitations = vi.fn()
    const msg = assistantMsg({
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    render(
      <MessageList
        chat={[msg]}
        {...baseProps}
        onToggleCitations={onToggleCitations}
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: /Used 1 local item/ }), { key: 'Escape' })
    expect(onToggleCitations).not.toHaveBeenCalled()
  })

  it('only closes the citation panel of the message receiving the Escape key', () => {
    const onToggleCitations = vi.fn()
    const msgWithCitations = assistantMsg({
      id: 'a1',
      citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet' }],
    })
    const otherMsg = assistantMsg({
      id: 'a2',
      content: 'Second answer',
      citations: [{ entityId: 'e2', entityName: 'Entity Two', snippet: 'Other snippet' }],
    })
    render(
      <MessageList
        chat={[msgWithCitations, otherMsg]}
        {...baseProps}
        showCitations="a1"
        onToggleCitations={onToggleCitations}
      />,
    )
    // Escape while focused inside the second (collapsed) message must not close
    // the first message's expanded panel.
    fireEvent.keyDown(screen.getAllByRole('button', { name: /Used 1 local item/ })[1], { key: 'Escape' })
    expect(onToggleCitations).not.toHaveBeenCalled()
  })
})

describe('SuggestionsBar', () => {
  it('renders suggestion chips and sends the query', () => {
    const onSend = vi.fn()
    render(<SuggestionsBar onSend={onSend} />)
    expect(screen.getByText('Try:')).toBeDefined()
    fireEvent.click(screen.getAllByText('What is TRIZ useful for?')[0])
    expect(onSend).toHaveBeenCalledWith('What is the TRIZ contradiction matrix useful for?')
  })

  it.each(EXPECTED_SUGGESTIONS)('chip "$label" exposes its label as the accessible name and sends the full query', ({ label, query }) => {
    const onSend = vi.fn()
    render(<SuggestionsBar onSend={onSend} />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onSend).toHaveBeenCalledWith(query)
  })

  it('renders suggestion chips as native focusable buttons (keyboard activatable via Enter/Space)', () => {
    render(<SuggestionsBar onSend={vi.fn()} />)
    const chips = screen.getAllByRole('button')
    expect(chips.length).toBe(EXPECTED_SUGGESTIONS.length)
    chips.forEach((chip) => {
      expect(chip.tagName).toBe('BUTTON')
      expect(chip).not.toBeDisabled()
      expect(chip.tabIndex).toBe(0)
      expect(chip.className).toContain('min-h-[44px]')
    })
  })
})

describe('InputBar', () => {
  const harness = (overrides: Partial<Parameters<typeof InputBar>[0]> = {}) => {
    const props = {
      input: '',
      setInput: vi.fn(),
      chatLoading: false,
      onSend: vi.fn(),
      onClear: vi.fn(),
      canClear: false,
      inputRef: createRef<HTMLTextAreaElement>(),
      ...overrides,
    }
    return render(<InputBar {...props} />)
  }

  it('renders textarea, voice input, send and clear controls', () => {
    harness()
    expect(screen.getByPlaceholderText(/Ask about your library/)).toBeDefined()
    expect(screen.getByTestId('voice-input')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Clear chat history' })).toBeDefined()
  })

  it('send and clear buttons expose matching tooltips', () => {
    harness()
    expect(screen.getByRole('button', { name: 'Send message' })).toHaveAttribute('title', 'Send message')
    expect(screen.getByRole('button', { name: 'Clear chat history' })).toHaveAttribute('title', 'Clear chat history')
  })

  it('disables send when input is empty and clear when nothing to clear', () => {
    harness()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear chat history' })).toBeDisabled()
  })

  it('forwards input changes through setInput', () => {
    const setInput = vi.fn()
    harness({ setInput })
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(setInput).toHaveBeenCalledWith('hello')
  })

  it('sends on Enter and via the send button', () => {
    const onSend = vi.fn()
    harness({ input: 'hello', onSend })
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(onSend).toHaveBeenCalledTimes(2)
  })

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn()
    harness({ input: 'hello', onSend })
    fireEvent.keyDown(screen.getByPlaceholderText(/Ask about your library/), { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('calls onClear from the clear button and forwards disabled state', () => {
    const onClear = vi.fn()
    harness({ canClear: true, onClear })
    const clearBtn = screen.getByRole('button', { name: 'Clear chat history' })
    expect(clearBtn).toBeEnabled()
    fireEvent.click(clearBtn)
    expect(onClear).toHaveBeenCalled()
  })

  it('forwards chatLoading to the controls', () => {
    harness({ chatLoading: true })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByPlaceholderText(/Ask about your library/)).toBeDisabled()
  })

  it('shows the local search status and shortcut hint', () => {
    harness()
    expect(screen.getByText('Local search active')).toBeDefined()
    expect(screen.getByText(/Enter to send/)).toBeDefined()
  })
})
