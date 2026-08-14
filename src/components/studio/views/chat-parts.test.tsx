import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  WelcomePanel,
  MessageList,
  SuggestionsBar,
  InputBar,
} from './chat-view'
import type { ChatMessage } from '@/lib/studio/types'

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
    Send: Icon,
    Sparkles: Icon,
    Trash2: Icon,
    Bot: Icon,
    User: Icon,
    Quote: Icon,
    ChevronDown: Icon,
    MessageSquare: Icon,
  }
})

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('../voice-input', () => ({
  VoiceInput: ({ onTranscript: _t, disabled }: { onTranscript?: (t: string) => void; disabled?: boolean }) => (
    <div data-testid="voice-input" data-disabled={String(Boolean(disabled))} />
  ),
}))

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
})

describe('SuggestionsBar', () => {
  it('renders suggestion chips and sends the query', () => {
    const onSend = vi.fn()
    render(<SuggestionsBar onSend={onSend} />)
    expect(screen.getByText('Try:')).toBeDefined()
    fireEvent.click(screen.getAllByText('What is TRIZ useful for?')[0])
    expect(onSend).toHaveBeenCalledWith('What is the TRIZ contradiction matrix useful for?')
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
