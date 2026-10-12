import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode, act } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const { mockSendChatStream, mockBuildMessagesAsync } = vi.hoisted(() => ({
  mockSendChatStream: vi.fn<(request: ChatRequest, onChunk: (chunk: string) => void) => Promise<ChatResult>>(),
  mockBuildMessagesAsync: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  sendChatStream: mockSendChatStream,
  buildMessagesAsync: mockBuildMessagesAsync,
  useRateLimiter: () => ({ canRequest: () => ({ allowed: true, count: 1, limit: 10 }) }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Bot: Icon, User: Icon, Send: Icon, Square: Icon, Sparkles: Icon, Lightbulb: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { AiHarnessChatPanel } from './ai-harness-chat'
import { useAiHarnessChat, type UseAiHarnessChatOptions } from './use-ai-harness-chat'
import type { ChatMessage, ChatRequest, ChatResult } from '@/lib/ai'

const defaultProps = {
  messages: [
    { role: 'assistant' as const, content: 'AI agent ready to assist with knowledge synthesis. Ask me anything about your local knowledge base.' },
  ] as ChatMessage[],
  isLoading: false,
  input: '',
  setInput: vi.fn(),
  handleSend: vi.fn(),
  reducedMotion: false,
  augment: true,
  effectiveModel: 'openrouter/free',
  cooldownMs: 0,
}

describe('AiHarnessChatPanel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the chat container', () => {
    render(<AiHarnessChatPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText(/Ask the AI agent/)).toBeDefined()
  })

  it('renders messages', () => {
    render(<AiHarnessChatPanel {...defaultProps} />)
    expect(screen.getByText(/AI agent ready to assist/)).toBeDefined()
  })

  it('renders user and assistant messages with different styles', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is TRIZ?' },
      { role: 'assistant', content: 'TRIZ is a problem-solving methodology.' },
    ]
    render(<AiHarnessChatPanel {...defaultProps} messages={messages} />)
    expect(screen.getByText('What is TRIZ?')).toBeDefined()
    expect(screen.getByText('TRIZ is a problem-solving methodology.')).toBeDefined()
  })

  it('shows Thinking indicator when loading', () => {
    render(<AiHarnessChatPanel {...defaultProps} isLoading />)
    expect(screen.getByText('Thinking…')).toBeDefined()
  })

  it('does not show Thinking indicator when not loading', () => {
    render(<AiHarnessChatPanel {...defaultProps} isLoading={false} />)
    expect(screen.queryByText('Thinking…')).toBeNull()
  })

  it('renders send button', () => {
    render(<AiHarnessChatPanel {...defaultProps} />)
    expect(screen.getByLabelText('Send')).toBeDefined()
  })

  it('disables send button when input is empty', () => {
    render(<AiHarnessChatPanel {...defaultProps} input="" />)
    const sendBtn = screen.getByLabelText('Send')
    expect(sendBtn).toBeDisabled()
  })

  it('enables send button when input has text', () => {
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" />)
    const sendBtn = screen.getByLabelText('Send')
    expect(sendBtn).not.toBeDisabled()
  })

  it('renders Stop button when loading and clicking calls onStop', () => {
    const onStop = vi.fn()
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" isLoading onStop={onStop} />)
    const stopBtn = screen.getByLabelText('Stop generating')
    expect(stopBtn).toBeDefined()
    fireEvent.click(stopBtn)
    expect(onStop).toHaveBeenCalled()
    expect(screen.queryByLabelText('Send')).toBeNull()
  })

  it('disables textarea when loading', () => {
    render(<AiHarnessChatPanel {...defaultProps} isLoading />)
    const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
    expect(textarea).toBeDisabled()
  })

  it('disables textarea during cooldown', () => {
    render(<AiHarnessChatPanel {...defaultProps} cooldownMs={5000} />)
    const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
    expect(textarea).toBeDisabled()
  })

  it('shows cooldown message', () => {
    render(<AiHarnessChatPanel {...defaultProps} cooldownMs={3000} />)
    expect(screen.getByText(/Wait 3s before sending again/)).toBeDefined()
  })

  it('shows augmented indicator when augment is true', () => {
    render(<AiHarnessChatPanel {...defaultProps} augment />)
    expect(screen.getByText('Augmented with local knowledge')).toBeDefined()
  })

  it('shows no augmentation indicator when augment is false', () => {
    render(<AiHarnessChatPanel {...defaultProps} augment={false} />)
    expect(screen.getByText('No augmentation')).toBeDefined()
  })

  it('shows effective model', () => {
    render(<AiHarnessChatPanel {...defaultProps} effectiveModel="gpt-4o" />)
    expect(screen.getByText('gpt-4o')).toBeDefined()
  })

  it('calls setInput on textarea change', () => {
    const setInput = vi.fn()
    render(<AiHarnessChatPanel {...defaultProps} setInput={setInput} />)
    const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
    fireEvent.change(textarea, { target: { value: 'New message' } })
    expect(setInput).toHaveBeenCalledWith('New message')
  })

  it('calls handleSend on Enter key', () => {
    const handleSend = vi.fn()
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" handleSend={handleSend} />)
    const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(handleSend).toHaveBeenCalled()
  })

  it('does not call handleSend on Shift+Enter', () => {
    const handleSend = vi.fn()
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" handleSend={handleSend} />)
    const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(handleSend).not.toHaveBeenCalled()
  })

  it('calls handleSend on send button click', () => {
    const handleSend = vi.fn()
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" handleSend={handleSend} />)
    fireEvent.click(screen.getByLabelText('Send'))
    expect(handleSend).toHaveBeenCalled()
  })

  it('textarea has aria-label', () => {
    render(<AiHarnessChatPanel {...defaultProps} />)
    expect(screen.getByLabelText('AI agent message')).toBeDefined()
  })

  it('shows suggestions when provided and conversation is fresh', () => {
    render(
      <AiHarnessChatPanel
        {...defaultProps}
        suggestions={[
          { label: 'Summarize my library', prompt: 'Summarize the main entities.' },
        ]}
      />,
    )
    expect(screen.getByText('Try asking')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Summarize my library' })).toBeDefined()
  })

  it('hides suggestions once the user has typed input', () => {
    render(
      <AiHarnessChatPanel
        {...defaultProps}
        input="Hello"
        suggestions={[{ label: 'Summarize', prompt: 'Summarize.' }]}
      />,
    )
    expect(screen.queryByText('Try asking')).toBeNull()
  })

  it('hides suggestions when messages exist beyond the first', () => {
    render(
      <AiHarnessChatPanel
        {...defaultProps}
        messages={[
          { role: 'assistant', content: 'hi' },
          { role: 'user', content: 'hello' },
        ]}
        suggestions={[{ label: 'Summarize', prompt: 'Summarize.' }]}
      />,
    )
    expect(screen.queryByText('Try asking')).toBeNull()
  })

  it('sends the suggestion prompt via handleSend override when clicked (#846)', () => {
    const handleSend = vi.fn()
    render(
      <AiHarnessChatPanel
        {...defaultProps}
        handleSend={handleSend}
        suggestions={[{ label: 'Summarize my library', prompt: 'Summarize the main entities.' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Summarize my library' }))
    // The prompt travels as the send override — routing it through setInput
    // first raced the hook's empty-input guard and silently aborted (#846).
    expect(handleSend).toHaveBeenCalledWith('Summarize the main entities.')
  })

  it('renders duplicate content messages independently without key collisions', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hello' },
      { id: '3', role: 'user', content: 'Hello' },
    ]
    render(<AiHarnessChatPanel {...defaultProps} messages={messages} />)
    const elements = screen.getAllByText('Hello')
    expect(elements.length).toBe(3)
  })

  it('keeps the assistant bubble mounted when streamed content changes (#928)', () => {
    const transcript = (content: string): ChatMessage[] => [
      { id: 'u-1', role: 'user', content: 'hi' },
      { id: 'a-1', role: 'assistant', content },
    ]
    const { rerender } = render(
      <AiHarnessChatPanel {...defaultProps} messages={transcript('Chunk 1')} />,
    )

    // A content-keyed `key` remounts the row on every delta, discarding this
    // marker (and the DOM node) along with it.
    const bubble = screen.getByText('Chunk 1')
    bubble.dataset.probe = 'streamed-bubble'

    rerender(<AiHarnessChatPanel {...defaultProps} messages={transcript('Chunk 1 Chunk 2')} />)

    const updated = screen.getByText('Chunk 1 Chunk 2')
    expect(updated.dataset.probe).toBe('streamed-bubble')
    expect(updated).toBe(bubble)
  })

  it('keeps duplicate-content bubbles distinct when a later one updates (#928)', () => {
    const transcript = (second: string): ChatMessage[] => [
      { id: 'u-1', role: 'user', content: 'Hello' },
      { id: 'u-2', role: 'user', content: second },
    ]
    const { rerender } = render(
      <AiHarnessChatPanel {...defaultProps} messages={transcript('Hello')} />,
    )

    const [first, second] = screen.getAllByText('Hello')
    first.dataset.probe = 'first-bubble'
    second.dataset.probe = 'second-bubble'

    rerender(<AiHarnessChatPanel {...defaultProps} messages={transcript('Hello there')} />)

    expect(screen.getByText('Hello').dataset.probe).toBe('first-bubble')
    expect(screen.getByText('Hello there').dataset.probe).toBe('second-bubble')
  })

  it('renders transcript container as role="log" with aria-live="off"', () => {
    render(<AiHarnessChatPanel {...defaultProps} />)
    const logRegion = screen.getByRole('log', { name: 'AI chat transcript' })
    expect(logRegion).toBeDefined()
    expect(logRegion.getAttribute('aria-live')).toBe('off')
  })

  it('announces a turn once the completion counter advances', () => {
    const { rerender } = render(<AiHarnessChatPanel {...defaultProps} completedTurns={0} />)
    const statusRegion = screen.getByRole('status')
    expect(statusRegion.textContent).toBe('')

    // Turn in flight: nothing to announce yet.
    rerender(<AiHarnessChatPanel {...defaultProps} isLoading completedTurns={0} />)
    expect(statusRegion.textContent).toBe('')

    // Turn finished with the hook reporting one completed turn.
    rerender(<AiHarnessChatPanel {...defaultProps} completedTurns={1} />)
    expect(statusRegion.textContent).toBe('Response complete')

    // Re-rendering with the same counter (as StrictMode's double-invoked
    // effect does) must not speak the turn a second time.
    rerender(<AiHarnessChatPanel {...defaultProps} completedTurns={1} />)
    expect(statusRegion.textContent).toBe('Response complete')
  })

  it('stays silent when a turn fails at the provider', () => {
    // A rejected turn appends an `[Error] …` bubble and leaves the counter
    // alone, so all the panel sees is isLoading dropping again.
    const { rerender } = render(<AiHarnessChatPanel {...defaultProps} completedTurns={0} />)
    const statusRegion = screen.getByRole('status')

    rerender(<AiHarnessChatPanel {...defaultProps} isLoading completedTurns={0} />)
    rerender(<AiHarnessChatPanel {...defaultProps} isLoading={false} completedTurns={0} />)

    expect(statusRegion.textContent).toBe('')
  })

  it('stays silent when the user stops a turn', () => {
    // Stop aborts the stream: the hook returns early, adds nothing, and the
    // counter stays put.
    const { rerender } = render(<AiHarnessChatPanel {...defaultProps} completedTurns={2} />)
    const statusRegion = screen.getByRole('status')

    rerender(<AiHarnessChatPanel {...defaultProps} isLoading completedTurns={2} />)
    rerender(<AiHarnessChatPanel {...defaultProps} isLoading={false} completedTurns={2} />)

    expect(statusRegion.textContent).toBe('')
  })

  it('clears the announcement between turns so the next completion speaks', () => {
    const { rerender } = render(<AiHarnessChatPanel {...defaultProps} completedTurns={1} />)
    const statusRegion = screen.getByRole('status')
    rerender(<AiHarnessChatPanel {...defaultProps} completedTurns={2} />)
    expect(statusRegion.textContent).toBe('Response complete')

    // A live region whose text never changes is not re-announced, so the next
    // turn has to empty it before it can speak again.
    rerender(<AiHarnessChatPanel {...defaultProps} isLoading completedTurns={2} />)
    expect(statusRegion.textContent).toBe('')

    rerender(<AiHarnessChatPanel {...defaultProps} completedTurns={3} />)
    expect(statusRegion.textContent).toBe('Response complete')
  })

  it('does not announce a turn that completed before the panel mounted', () => {
    render(<AiHarnessChatPanel {...defaultProps} completedTurns={4} />)
    expect(screen.getByRole('status').textContent).toBe('')
  })
})

/** Baseline hook options for the session harness; tests only drive the provider. */
const chatOptions: UseAiHarnessChatOptions = {
  provider: 'local',
  model: 'onnx-community/Qwen2.5-0.5B-Instruct',
  apiKey: '',
  augment: false,
  allowWebResearch: false,
  ollamaCpuOnly: false,
  ollamaBaseUrl: 'http://localhost:11434',
  localDevice: 'wasm',
  entities: [],
  claims: [],
  requiresKey: false,
}

/** The panel wired to the real hook, so announcements follow real turn outcomes. */
const ChatPanelWithSession = () => {
  const chat = useAiHarnessChat({ ...chatOptions })
  return (
    <div>
      <button type="button" onClick={() => { void chat.handleSend('hello') }}>send</button>
      <AiHarnessChatPanel
        messages={chat.messages}
        isLoading={chat.isLoading}
        completedTurns={chat.completedTurns}
        input={chat.input}
        setInput={chat.setInput}
        handleSend={chat.handleSend}
        reducedMotion={false}
        augment={false}
        effectiveModel="local/qwen"
      />
    </div>
  )
}

describe('AiHarnessChatPanel completion announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildMessagesAsync.mockResolvedValue([{ role: 'user', content: 'hello' }])
  })

  it('announces a successful streamed turn, exactly once', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Hello')
      onChunk(' world')
      return { content: 'Hello world', provider: 'local', model: chatOptions.model }
    })
    // StrictMode double-invokes effects; the announcement must still land once.
    const { rerender } = render(<StrictMode><ChatPanelWithSession /></StrictMode>)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Response complete')
    })
    // One region, one message: the completion is spoken once, not per token.
    expect(screen.getAllByRole('status')).toHaveLength(1)

    // An unchanged counter (a re-render, or StrictMode re-running the effect)
    // must not clear and re-announce the same turn.
    rerender(<StrictMode><ChatPanelWithSession /></StrictMode>)
    expect(screen.getByRole('status').textContent).toBe('Response complete')
  })

  it('does not announce a turn the provider rejected', async () => {
    mockSendChatStream.mockRejectedValue(new Error('provider exploded'))
    render(<ChatPanelWithSession />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
    })

    // The error bubble is the turn's terminal state — assert after it lands so
    // the silent-status check cannot pass before the turn settles.
    await waitFor(() => {
      expect(screen.getByText(/\[Error\] provider exploded/)).toBeDefined()
    })
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('does not announce a turn the user stopped', async () => {
    // Stop, and a turn superseded by the next send, both surface as an
    // AbortError: the hook returns early and adds nothing to the transcript.
    mockSendChatStream.mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    render(<ChatPanelWithSession />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
    })

    // The composer re-enabling is the turn's terminal state — assert after it
    // so the silent-status check cannot pass before the turn settles.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask the AI agent/)).not.toBeDisabled()
    })
    expect(screen.queryByText(/\[Error\]/)).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
