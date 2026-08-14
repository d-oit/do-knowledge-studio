import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

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

const mockSendMessage = vi.fn()
const mockClearChat = vi.fn()
const mockSetView = vi.fn()
const mockSelectEntity = vi.fn()

let currentChat: Array<Record<string, unknown>> = []
let currentChatLoading = false

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      chat: currentChat,
      chatLoading: currentChatLoading,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      setView: mockSetView,
      selectEntity: mockSelectEntity,
    }),
}))

import { ChatView } from './chat-view'

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    currentChat = []
    currentChatLoading = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders empty state when no messages', () => {
    render(<ChatView />)
    expect(screen.getByText('Ask your library')).toBeDefined()
  })

  it('explains local capabilities in the empty state', () => {
    render(<ChatView />)
    expect(screen.getByText('What you can ask')).toBeDefined()
    expect(screen.getByText('Search notes, people, projects, and claims in this browser')).toBeDefined()
    expect(screen.getByText('Synthesize connections across your local knowledge base')).toBeDefined()
    expect(screen.getByText('Show the local items used to support each answer')).toBeDefined()
  })

  it('shows suggestion chips in empty state', () => {
    render(<ChatView />)
    expect(screen.getAllByText('Summarize recent projects').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Key people').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('What is TRIZ useful for?').length).toBeGreaterThanOrEqual(1)
  })

  it('suggestion chip calls sendMessage', async () => {
    vi.useFakeTimers()
    render(<ChatView />)
    screen.getAllByText('Summarize recent projects')[0].click()
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(mockSendMessage).toHaveBeenCalledWith('Give me a summary of the projects in my library.')
    vi.useRealTimers()
  })

  it('debounces rapid sends to only one call', async () => {
    vi.useFakeTimers()
    render(<ChatView />)
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!
    await act(async () => {
      nativeInputValueSetter.call(textarea, 'Hello')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // Immediately send again before debounce fires
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith('Hello')
    vi.useRealTimers()
  })

  it('input textarea exists with maxLength 2000', () => {
    render(<ChatView />)
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    expect(textarea).toBeDefined()
    expect(textarea).toHaveAttribute('maxLength', '2000')
  })

  it('send button exists', () => {
    render(<ChatView />)
    expect(screen.getByLabelText('Send message')).toBeDefined()
  })

  it('clear chat button exists', () => {
    render(<ChatView />)
    expect(screen.getByText('Clear')).toBeDefined()
  })

  it('clear chat button is disabled when no messages', () => {
    render(<ChatView />)
    const clearBtn = screen.getByText('Clear').closest('button')!
    expect(clearBtn).toHaveProperty('disabled', true)
  })

  it('clear button calls clearChat when clicked with messages', () => {
    currentChat = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
    ]
    render(<ChatView />)
    const clearBtn = screen.getByText('Clear').closest('button')!
    clearBtn.click()
    expect(mockClearChat).toHaveBeenCalled()
  })

  it('renders user and assistant messages', () => {
    currentChat = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello there',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi! How can I help?',
        timestamp: new Date().toISOString(),
      },
    ]
    render(<ChatView />)
    expect(screen.getByText('Hello there')).toBeDefined()
    expect(screen.getByText('Hi! How can I help?')).toBeDefined()
  })

  it('announces message sender roles to screen readers', () => {
    currentChat = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello there',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi! How can I help?',
        timestamp: new Date().toISOString(),
      },
    ]
    render(<ChatView />)
    expect(screen.getByText(/^You:$/)).toBeDefined()
    expect(screen.getByText(/^Assistant:$/)).toBeDefined()
  })

  it('send button exposes a matching tooltip', () => {
    render(<ChatView />)
    const sendBtn = screen.getByRole('button', { name: 'Send message' })
    expect(sendBtn).toHaveAttribute('title', 'Send message')
  })

  it('clear chat button exposes a matching tooltip and label', () => {
    render(<ChatView />)
    const clearBtn = screen.getByRole('button', { name: 'Clear chat history' })
    expect(clearBtn).toHaveAttribute('title', 'Clear chat history')
  })

  it('assistant messages render via Markdown', () => {
    currentChat = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Some **bold** text',
        timestamp: new Date().toISOString(),
      },
    ]
    render(<ChatView />)
    expect(screen.getByTestId('markdown')).toBeDefined()
  })

  it('shows TypingIndicator when chatLoading is true', () => {
    currentChatLoading = true
    render(<ChatView />)
    expect(screen.getByLabelText('Assistant is typing')).toBeDefined()
  })

  it('hides TypingIndicator when chatLoading is false', () => {
    currentChatLoading = false
    render(<ChatView />)
    expect(screen.queryByLabelText('Assistant is typing')).toBeNull()
  })

  it('character counter shows above 1800 chars', async () => {
    render(<ChatView />)
    const textarea = screen.getByPlaceholderText(/Ask about your library/)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!
    await act(async () => {
      nativeInputValueSetter.call(textarea, 'a'.repeat(1850))
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(screen.getByText('1850/2000')).toBeDefined()
  })

  it('shows local search active indicator', () => {
    render(<ChatView />)
    expect(screen.getByText('Local search active')).toBeDefined()
  })
})
