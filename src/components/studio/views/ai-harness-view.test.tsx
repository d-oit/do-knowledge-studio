import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
    aside: ({ children, initial: _i, animate: _a, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <aside {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</aside>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
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
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/ai-settings', () => ({
  loadAISettings: vi.fn(() =>
    Promise.resolve({
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: '',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }),
  ),
  saveAISettings: vi.fn(),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/lib/ai', () => ({
  sendChatStream: vi.fn(),
  fetchOllamaModels: vi.fn(() => Promise.resolve([])),
  buildMessages: vi.fn(() => []),
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
  SwitchToggle: ({ label }: { label: string }) => (
    <label data-testid="switch-toggle">{label}</label>
  ),
}))

const mockEntities = [
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
]

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: mockEntities,
      claims: [],
    }),
}))

import { AIHarnessView } from './ai-harness-view'

describe('AIHarnessView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the AI Harness header', () => {
    render(<AIHarnessView />)
    expect(screen.getByText('AI Harness')).toBeDefined()
  })

  it('renders the Lab badge', () => {
    render(<AIHarnessView />)
    expect(screen.getByText('Lab')).toBeDefined()
  })

  it('renders settings toggle button', () => {
    render(<AIHarnessView />)
    expect(screen.getByText('Show settings')).toBeDefined()
  })

  it('shows settings panel when toggle clicked', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    expect(screen.getByText('Hide settings')).toBeDefined()
    expect(screen.getByText('Augment with local knowledge')).toBeDefined()
  })

  it('provider dropdown exists in settings panel', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(1)
  })

  it('API key input field exists when settings open', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    expect(screen.getByPlaceholderText('sk-or-\u2026')).toBeDefined()
  })

  it('chat textarea exists', () => {
    render(<AIHarnessView />)
    expect(screen.getByPlaceholderText(/Ask the AI agent/)).toBeDefined()
  })

  it('send button exists', () => {
    render(<AIHarnessView />)
    expect(screen.getByLabelText('Send')).toBeDefined()
  })

  it('renders initial assistant message', () => {
    render(<AIHarnessView />)
    expect(screen.getByText(/AI agent ready to assist/)).toBeDefined()
  })

  it('shows save button when settings open', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    expect(screen.getByText('Save settings')).toBeDefined()
  })

  it('shows status as Ready when not loading', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    expect(screen.getByText('Ready')).toBeDefined()
  })

  it('shows connected database field in settings', () => {
    render(<AIHarnessView />)
    act(() => { screen.getByText('Show settings').click() })
    expect(screen.getByText(/Connected/)).toBeDefined()
  })
})
