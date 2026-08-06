import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Hoisted so vi.mock factories (hoisted above imports) can reference these mocks.
const aiMocks = vi.hoisted(() => {
  const mockSendChatStream = vi.fn()
  const mockFetchOllamaModels = vi.fn(() => Promise.resolve(['llama3']))
  const mockBuildMessages = vi.fn(() => [])
  const mockLoadAISettings = vi.fn(() =>
    Promise.resolve({
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: '',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }),
  )
  const mockSaveAISettings = vi.fn((_s: Record<string, unknown>) => Promise.resolve())
  const mockFetchUrls = vi.fn(() =>
    Promise.resolve([{ success: true, url: 'https://example.com' }]),
  )
  return {
    mockSendChatStream,
    mockFetchOllamaModels,
    mockBuildMessages,
    mockLoadAISettings,
    mockSaveAISettings,
    mockFetchUrls,
  }
})

const rateLimitState = vi.hoisted(() => ({
  decision: { allowed: true, count: 0, limit: 10, retryAfterMs: 5000 },
}))

const storeState = vi.hoisted(() => ({
  mockEntities: [
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
  ],
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
    FlaskConical: Icon,
    Bot: Icon,
    User: Icon,
    Send: Icon,
    Settings: Icon,
    Database: Icon,
    Key: Icon,
    Cpu: Icon,
    Plug: Icon,
    Check: Icon,
    BookOpen: Icon,
    Sparkles: Icon,
    Zap: Icon,
    RefreshCw: Icon,
    Globe: Icon,
    KeyRound: Icon,
    Lightbulb: Icon,
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/ai-settings', () => ({
  loadAISettings: () => aiMocks.mockLoadAISettings(),
  saveAISettings: (s: Record<string, unknown>) => aiMocks.mockSaveAISettings(s),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/lib/ai', () => ({
  sendChatStream: aiMocks.mockSendChatStream,
  fetchOllamaModels: aiMocks.mockFetchOllamaModels,
  buildMessages: aiMocks.mockBuildMessages,
  useRateLimiter: () => ({ canRequest: () => rateLimitState.decision }),
  OPENROUTER_ROUTERS: [{ slug: 'openrouter/auto', display_name: 'Auto Router' }],
  OPENROUTER_MODELS: [{ slug: 'openai/gpt-4o-mini', display_name: 'GPT-4o Mini' }],
  OPENROUTER_DEFAULT_TARGETS: [
    { slug: 'openrouter/auto', display_name: 'Auto Router' },
    { slug: 'openai/gpt-4o-mini', display_name: 'GPT-4o Mini' },
  ],
}))

vi.mock('@/lib/ai/types', () => ({
  DEFAULT_MODEL: { openrouter: 'openrouter/free', ollama: 'llama3' },
  OLLAMA_DEFAULT_MODELS: ['llama3', 'mistral'],
  DEFAULT_OLLAMA_BASE_URL: 'http://localhost:11434',
}))

vi.mock('@/lib/ai/research', () => ({
  extractUrls: (text: string) => (text.includes('http') ? ['https://example.com'] : []),
  fetchUrls: aiMocks.mockFetchUrls,
}))

vi.mock('./ai-harness-settings', () => ({
  PROVIDERS: [
    { id: 'openrouter', label: 'OpenRouter', models: ['openrouter/free'], requiresKey: true },
    { id: 'ollama', label: 'Ollama (local)', models: ['llama3'], requiresKey: false },
  ],
  Field: ({ label, children }: { label: string; children?: ReactNode }) => (
    <div data-testid="field">
      <span>{label}</span>
      {children}
    </div>
  ),
}))

vi.mock('../ui/shared-primitives', () => ({
  SwitchToggle: ({
    label,
    checked,
    onToggle,
  }: {
    label: string
    checked?: boolean
    onToggle?: () => void
  }) => (
    <button
      data-testid="switch-toggle"
      data-checked={String(Boolean(checked))}
      onClick={() => onToggle?.()}
    >
      {label}
    </button>
  ),
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: storeState.mockEntities,
      claims: [],
    }),
}))

import { AIHarnessView } from './ai-harness-view'

const sendMessage = async (text: string) => {
  const textarea = screen.getByPlaceholderText(/Ask the AI agent/)
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.click(screen.getByLabelText('Send'))
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    await Promise.resolve()
  })
}

describe('AIHarnessView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitState.decision = { allowed: true, count: 0, limit: 10, retryAfterMs: 5000 }
    aiMocks.mockSendChatStream.mockImplementation(() => Promise.resolve())
    aiMocks.mockFetchOllamaModels.mockImplementation(() => Promise.resolve(['llama3']))
    aiMocks.mockBuildMessages.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('does not send when input is empty', async () => {
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByLabelText('Send'))
    expect(aiMocks.mockSendChatStream).not.toHaveBeenCalled()
  })

  it('shows error toast when no API key and provider requires it', async () => {
    await act(async () => {
      render(<AIHarnessView />)
    })
    await sendMessage('Hello')
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Set an API key in settings to send messages.')
    expect(aiMocks.mockSendChatStream).not.toHaveBeenCalled()
  })

  it('sends message and streams response', async () => {
    aiMocks.mockSendChatStream.mockImplementation(
      async (_opts: unknown, onChunk: (c: string) => void) => {
        onChunk('chunk1')
      },
    )
    await act(async () => {
      render(<AIHarnessView />)
    })
    // Open settings, set API key, then send
    fireEvent.click(screen.getByText('Show settings'))
    const keyInput = screen.getByPlaceholderText('sk-or-\u2026')
    fireEvent.change(keyInput, { target: { value: 'test-key' } })
    await sendMessage('Hello')
    await waitFor(() => {
      expect(aiMocks.mockSendChatStream).toHaveBeenCalled()
    })
    expect(aiMocks.mockBuildMessages).toHaveBeenCalled()
  })

  it('adds error message when sendChatStream throws', async () => {
    aiMocks.mockSendChatStream.mockRejectedValue(new Error('boom'))
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    const keyInput = screen.getByPlaceholderText('sk-or-\u2026')
    fireEvent.change(keyInput, { target: { value: 'test-key' } })
    await sendMessage('Hello')
    await waitFor(() => {
      expect(screen.getByText(/\[Error\] boom/)).toBeDefined()
    })
  })

  it('adds rate-limited assistant message when rate limited', async () => {
    rateLimitState.decision = { allowed: false, count: 10, limit: 10, retryAfterMs: 5000 }
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    const keyInput = screen.getByPlaceholderText('sk-or-\u2026')
    fireEvent.change(keyInput, { target: { value: 'test-key' } })
    await sendMessage('Hello')
    await waitFor(() => {
      expect(screen.getByText(/rate-limited/)).toBeDefined()
    })
  })

  it('fetches URLs when web research is allowed', async () => {
    aiMocks.mockSendChatStream.mockImplementation(() => Promise.resolve())
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    const keyInput = screen.getByPlaceholderText('sk-or-\u2026')
    fireEvent.change(keyInput, { target: { value: 'test-key' } })
    // Click the "Allow web research" toggle explicitly
    fireEvent.click(screen.getByText('Allow web research'))
    await sendMessage('Check https://example.com')
    await waitFor(() => {
      expect(aiMocks.mockSendChatStream).toHaveBeenCalled()
    })
    expect(aiMocks.mockFetchUrls).toHaveBeenCalled()
  })

  it('handles abort error without adding message', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    aiMocks.mockSendChatStream.mockRejectedValue(abortError)
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    const keyInput = screen.getByPlaceholderText('sk-or-\u2026')
    fireEvent.change(keyInput, { target: { value: 'test-key' } })
    await sendMessage('Hello')
    // Wait for loading to finish (abort path returns early without an error message)
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeDefined()
    })
    expect(screen.queryByText(/\[Error\]/)).toBeNull()
  })

  it('saves settings after load', async () => {
    await act(async () => {
      render(<AIHarnessView />)
    })
    await waitFor(() => {
      expect(aiMocks.mockSaveAISettings).toHaveBeenCalled()
    })
  })

  it('fetches ollama models on refresh button click', async () => {
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    // Switch provider to ollama so the refresh button appears
    const providerSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(providerSelect, { target: { value: 'ollama' } })
    fireEvent.click(screen.getByLabelText('Refresh Ollama models'))
    await waitFor(() => {
      expect(aiMocks.mockFetchOllamaModels).toHaveBeenCalled()
    })
  })

  it('falls back to default models when fetch returns none', async () => {
    aiMocks.mockFetchOllamaModels.mockResolvedValue([])
    await act(async () => {
      render(<AIHarnessView />)
    })
    fireEvent.click(screen.getByText('Show settings'))
    const providerSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(providerSelect, { target: { value: 'ollama' } })
    fireEvent.click(screen.getByLabelText('Refresh Ollama models'))
    await waitFor(() => {
      expect(aiMocks.mockFetchOllamaModels).toHaveBeenCalled()
    })
  })
})
