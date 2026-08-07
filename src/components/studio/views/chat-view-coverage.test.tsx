import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Hoisted so the vi.mock factory (hoisted above imports) can reference these safely.
const storeState = vi.hoisted(() => ({
  chat: [] as Array<Record<string, unknown>>,
  chatLoading: false,
  sendMessage: vi.fn(),
  clearChat: vi.fn(),
  setView: vi.fn(),
  selectEntity: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      transition: _t,
      ...props
    }: { children?: ReactNode; [key: string]: unknown }) => (
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../voice-input', () => ({
  VoiceInput: () => <div data-testid="voice-input" />,
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      chat: storeState.chat,
      chatLoading: storeState.chatLoading,
      sendMessage: storeState.sendMessage,
      clearChat: storeState.clearChat,
      setView: storeState.setView,
      selectEntity: storeState.selectEntity,
    }),
}))

import { ChatView } from './chat-view'

const setInput = (text: string) => {
  const textarea = screen.getByPlaceholderText(/Ask about your library/)
  fireEvent.change(textarea, { target: { value: text } })
  return textarea
}

const assistantMessage = (overrides: Record<string, unknown>) => ({
  id: 'msg-1',
  role: 'assistant',
  content: 'Answer',
  timestamp: new Date().toISOString(),
  ...overrides,
})

describe('ChatView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.chat = []
    storeState.chatLoading = false
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not send when input is empty', () => {
    render(<ChatView />)
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    // Enter on empty input calls handleSend() directly, exercising the !content guard
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(storeState.sendMessage).not.toHaveBeenCalled()
  })

  it('does not send when input is whitespace only', () => {
    render(<ChatView />)
    setInput('   ')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(storeState.sendMessage).not.toHaveBeenCalled()
  })

  it('does not send while chat is loading', () => {
    storeState.chatLoading = true
    render(<ChatView />)
    const textarea = setInput('Hello')
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(storeState.sendMessage).not.toHaveBeenCalled()
  })

  it('sends message on Enter key', async () => {
    vi.useFakeTimers()
    render(<ChatView />)
    const textarea = setInput('Hello')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(storeState.sendMessage).toHaveBeenCalledWith('Hello')
    vi.useRealTimers()
  })

  it('does not send on Shift+Enter and allows newline', () => {
    render(<ChatView />)
    const textarea = setInput('Hello')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(storeState.sendMessage).not.toHaveBeenCalled()
  })

  it('returns early from clear when chat is empty', () => {
    render(<ChatView />)
    const clearBtn = screen.getByText('Clear').closest('button')!
    clearBtn.click()
    expect(storeState.clearChat).not.toHaveBeenCalled()
  })

  it('renders citation section when message has citations', () => {
    storeState.chat = [
      assistantMessage({
        citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' }],
      }),
    ]
    render(<ChatView />)
    expect(screen.getByText(/Used 1 local item/)).toBeDefined()
  })

  it('uses singular item for one citation', () => {
    storeState.chat = [
      assistantMessage({
        citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' }],
      }),
    ]
    render(<ChatView />)
    expect(screen.getByText('Used 1 local item')).toBeDefined()
  })

  it('uses plural items for multiple citations', () => {
    storeState.chat = [
      assistantMessage({
        citations: [
          { entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' },
          { entityId: 'e2', entityName: 'Entity Two', snippet: 'Snippet two' },
        ],
      }),
    ]
    render(<ChatView />)
    expect(screen.getByText('Used 2 local items')).toBeDefined()
  })

  it('expands citations on toggle click', async () => {
    storeState.chat = [
      assistantMessage({
        citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' }],
      }),
    ]
    render(<ChatView />)
    const toggle = screen.getByRole('button', { name: /Used 1 local item/ })
    await act(async () => {
      toggle.click()
    })
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
    expect(screen.getByText('Entity One')).toBeDefined()
  })

  it('collapses citations on second toggle click', async () => {
    storeState.chat = [
      assistantMessage({
        citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' }],
      }),
    ]
    render(<ChatView />)
    const toggle = screen.getByRole('button', { name: /Used 1 local item/ })
    // Click and flush between clicks so the second click sees the updated state
    await act(async () => {
      toggle.click()
    })
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
    await act(async () => {
      toggle.click()
    })
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })
    expect(screen.queryByText('Entity One')).toBeNull()
  })

  it('opens entity from citation click', async () => {
    storeState.chat = [
      assistantMessage({
        citations: [{ entityId: 'e1', entityName: 'Entity One', snippet: 'Snippet one' }],
      }),
    ]
    render(<ChatView />)
    const toggle = screen.getByRole('button', { name: /Used 1 local item/ })
    await act(async () => {
      toggle.click()
    })
    await waitFor(() => {
      expect(screen.getByText('Entity One')).toBeDefined()
    })
    fireEvent.click(screen.getByText('Entity One'))
    expect(storeState.selectEntity).toHaveBeenCalledWith('e1')
    expect(storeState.setView).toHaveBeenCalledWith('editor')
  })

  it('shows char counter in clay when input reaches 2000', async () => {
    render(<ChatView />)
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!
    await act(async () => {
      nativeInputValueSetter.call(textarea, 'a'.repeat(2000))
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const counter = screen.getByText('2000/2000')
    expect(counter.className).toContain('text-clay')
  })

  it('shows suggestions bar below messages when chat has one message', () => {
    storeState.chat = [
      { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
    ]
    render(<ChatView />)
    expect(screen.getAllByText('Summarize recent projects').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Try:')).toBeDefined()
  })

  it('suggestion chip in bottom bar calls sendMessage', async () => {
    vi.useFakeTimers()
    storeState.chat = [
      { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
    ]
    render(<ChatView />)
    fireEvent.click(screen.getAllByText('Summarize recent projects')[0])
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(storeState.sendMessage).toHaveBeenCalledWith(
      'Give me a summary of the projects in my library.',
    )
    vi.useRealTimers()
  })
})
