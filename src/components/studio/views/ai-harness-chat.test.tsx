import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

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
  return { Bot: Icon, User: Icon, Send: Icon, Sparkles: Icon, Lightbulb: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { AiHarnessChatPanel } from './ai-harness-chat'
import type { ChatMessage } from '@/lib/ai'

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
    render(<AiHarnessChatPanel {...defaultProps} isLoading={true} />)
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

  it('disables send button when loading', () => {
    render(<AiHarnessChatPanel {...defaultProps} input="Hello" isLoading={true} />)
    const sendBtn = screen.getByLabelText('Send')
    expect(sendBtn).toBeDisabled()
  })

  it('disables textarea when loading', () => {
    render(<AiHarnessChatPanel {...defaultProps} isLoading={true} />)
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
    render(<AiHarnessChatPanel {...defaultProps} augment={true} />)
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

  it('sends the suggestion prompt when a suggestion is clicked', () => {
    const setInput = vi.fn()
    const handleSend = vi.fn()
    render(
      <AiHarnessChatPanel
        {...defaultProps}
        setInput={setInput}
        handleSend={handleSend}
        suggestions={[{ label: 'Summarize my library', prompt: 'Summarize the main entities.' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Summarize my library' }))
    expect(setInput).toHaveBeenCalledWith('Summarize the main entities.')
    expect(handleSend).toHaveBeenCalled()
  })
})
