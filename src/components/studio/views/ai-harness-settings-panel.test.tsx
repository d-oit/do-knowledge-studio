import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Database: Icon,
    Key: Icon,
    Cpu: Icon,
    Plug: Icon,
    Check: Icon,
    BookOpen: Icon,
    Zap: Icon,
    RefreshCw: Icon,
    Globe: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/ai', () => ({
  OPENROUTER_ROUTERS: [{ slug: 'openrouter/auto', display_name: 'Auto Router' }],
  OPENROUTER_MODELS: [{ slug: 'openai/gpt-4o-mini', display_name: 'GPT-4o Mini' }],
}))

vi.mock('@/lib/ai/types', () => ({
  DEFAULT_MODEL: { openrouter: 'openrouter/free', ollama: 'llama3' },
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
  SwitchToggle: ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
    <label data-testid="switch-toggle">
      {label}
      <input type="checkbox" checked={checked} onChange={onToggle} data-testid={`toggle-${label}`} />
    </label>
  ),
}))

import { AiHarnessSettingsPanel } from './ai-harness-settings-panel'

const defaultProps = {
  provider: 'openrouter' as const,
  setProvider: vi.fn(),
  model: 'openrouter/free',
  setModel: vi.fn(),
  apiKey: '',
  setApiKey: vi.fn(),
  showKey: false,
  setShowKey: vi.fn(),
  augment: true,
  setAugment: vi.fn(),
  ollamaCpuOnly: false,
  setOllamaCpuOnly: vi.fn(),
  ollamaBaseUrl: 'http://localhost:11434',
  setOllamaBaseUrl: vi.fn(),
  allowWebResearch: false,
  setAllowWebResearch: vi.fn(),
  customModel: '',
  setCustomModel: vi.fn(),
  ollamaModels: ['llama3', 'mistral'],
  handleRefreshOllamaModels: vi.fn(),
  entityCount: 42,
  effectiveModel: 'openrouter/free',
  selectedEngineTarget: null,
  isLoading: false,
}

describe('AiHarnessSettingsPanel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the Provider heading', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Provider' })).toBeDefined()
  })

  it('renders connected database status with entity count', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText(/Connected · 42 entities/)).toBeDefined()
  })

  it('renders provider selector', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(1)
  })

  it('renders API key input when provider requires key', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText('sk-or-…')).toBeDefined()
  })

  it('does not render API key input for ollama', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" />)
    expect(screen.queryByPlaceholderText('sk-or-…')).toBeNull()
  })

  it('renders augment toggle', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText(/Augment with local knowledge/)).toBeDefined()
  })

  it('renders web research toggle', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText(/Allow web research/)).toBeDefined()
  })

  it('shows status section', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('shows Ready when not loading', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText('Ready')).toBeDefined()
  })

  it('shows Thinking when loading', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} isLoading={true} />)
    expect(screen.getByText('Thinking…')).toBeDefined()
  })

  it('shows active engine model', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} effectiveModel="gpt-4o" />)
    expect(screen.getByText('gpt-4o')).toBeDefined()
  })

  it('shows ollama-specific fields when provider is ollama', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" />)
    expect(screen.getByText(/Ollama Base URL/)).toBeDefined()
    expect(screen.getByText(/CPU only/)).toBeDefined()
  })

  it('does not show ollama fields when provider is openrouter', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="openrouter" />)
    expect(screen.queryByText(/Ollama Base URL/)).toBeNull()
    expect(screen.queryByText(/CPU only/)).toBeNull()
  })

  it('shows refresh Ollama models button for ollama provider', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" />)
    expect(screen.getByLabelText('Refresh Ollama models')).toBeDefined()
  })

  it('calls handleRefreshOllamaModels on refresh click', () => {
    const handleRefresh = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" handleRefreshOllamaModels={handleRefresh} />)
    fireEvent.click(screen.getByLabelText('Refresh Ollama models'))
    expect(handleRefresh).toHaveBeenCalled()
  })

  it('shows show/hide API key toggle', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByLabelText('Show API key')).toBeDefined()
  })

  it('calls setShowKey on toggle click', () => {
    const setShowKey = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} setShowKey={setShowKey} />)
    fireEvent.click(screen.getByLabelText('Show API key'))
    expect(setShowKey).toHaveBeenCalledWith(true)
  })

  it('shows API key storage notice', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByText(/Stored in this browser only/)).toBeDefined()
  })

  it('shows custom model input', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText(/Or type a custom engine/)).toBeDefined()
  })

  it('shows engine target description when available', () => {
    render(
      <AiHarnessSettingsPanel
        {...defaultProps}
        selectedEngineTarget={{ slug: 'test', display_name: 'Test Model', description: 'A test model for testing.' }}
      />,
    )
    expect(screen.getByText('Test Model:')).toBeDefined()
    expect(screen.getByText('A test model for testing.')).toBeDefined()
  })
})
