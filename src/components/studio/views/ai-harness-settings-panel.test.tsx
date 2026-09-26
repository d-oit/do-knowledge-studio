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

// Partial mock: the URL guards are the REAL implementations. A hand-rolled
// stub previously diverged from them (no protocol check, Ollama accepted any
// host), which let a test pass that the shipped code would fail.
vi.mock('@/lib/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  OPENROUTER_ROUTERS: [{ slug: 'openrouter/auto', display_name: 'Auto Router' }],
  OPENROUTER_MODELS: [{ slug: 'openai/gpt-4o-mini', display_name: 'GPT-4o Mini' }],
  DEFAULT_LOCAL_MODELS: [{ id: 'onnx-community/Qwen2.5-0.5B-Instruct', displayName: 'Qwen2.5 0.5B Instruct', dtype: 'q4' }],
  LOCAL_PROVIDER_ID: 'local',
  JEV_PROVIDER_ID: 'jev',
  JEV_DEFAULT_MODELS: ['jev-1.13.0', 'jev-latest', 'von-1.2'],
}))

vi.mock('@/lib/ai/types', () => ({
  DEFAULT_MODEL: { openrouter: 'openrouter/free', ollama: 'llama3', local: 'onnx-community/Qwen2.5-0.5B-Instruct', jev: 'jev-1.13.0' },
  DEFAULT_OLLAMA_BASE_URL: 'http://localhost:11434',
  DEFAULT_JEV_BASE_URL: 'https://api.typesafe.ai',
  JEV_PROVIDER_ID: 'jev',
  JEV_DEFAULT_MODELS: ['jev-1.13.0', 'jev-latest', 'von-1.2'],
}))

vi.mock('./ai-harness-settings', () => ({
  PROVIDERS: [
    { id: 'openrouter', label: 'OpenRouter', models: ['openrouter/free'], requiresKey: true },
    { id: 'ollama', label: 'Ollama (local)', models: ['llama3'], requiresKey: false },
    { id: 'local', label: 'Local (in-browser)', models: ['onnx-community/Qwen2.5-0.5B-Instruct'], requiresKey: false },
    { id: 'jev', label: 'TypeSafe Jev / Von (Decision API)', models: ['jev-1.13.0'], requiresKey: true },
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
  jevBaseUrl: 'https://api.typesafe.ai',
  setJevBaseUrl: vi.fn(),
  localDevice: 'wasm' as const,
  setLocalDevice: vi.fn(),
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

  it('hides the API key field and shows the download hint for the local provider', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="local" model="onnx-community/Qwen2.5-0.5B-Instruct" />)
    expect(screen.queryByPlaceholderText('sk-or-…')).toBeNull()
    expect(screen.getByText(/First use downloads the model/)).toBeDefined()
    expect(screen.getByText('Qwen2.5 0.5B Instruct')).toBeDefined()
  })

  it('sets the local default model when switching the provider to local', () => {
    const setModel = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} setModel={setModel} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'local' } })
    expect(setModel).toHaveBeenCalledWith('onnx-community/Qwen2.5-0.5B-Instruct')
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
    render(<AiHarnessSettingsPanel {...defaultProps} isLoading />)
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

  it('offers the Jev base URL field and its three decision models', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" model="jev-1.13.0" />)
    expect(screen.getByPlaceholderText('https://api.typesafe.ai')).toBeDefined()
    expect(screen.getByText('jev-1.13.0')).toBeDefined()
    expect(screen.getByText('jev-latest')).toBeDefined()
    expect(screen.getByText('von-1.2')).toBeDefined()
  })

  it('does not commit a half-typed Jev base URL to settings', () => {
    const setJevBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" setJevBaseUrl={setJevBaseUrl} />)
    const input = screen.getByPlaceholderText('https://api.typesafe.ai')

    // Autosave runs on every keystroke, so a partial host must stay local to
    // the input rather than reaching the settings writer.
    fireEvent.change(input, { target: { value: 'http' } })
    expect(setJevBaseUrl).not.toHaveBeenCalled()

    fireEvent.blur(input)
    expect(setJevBaseUrl).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('commits the normalized Jev base URL on blur', () => {
    const setJevBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" setJevBaseUrl={setJevBaseUrl} />)
    const input = screen.getByPlaceholderText('https://api.typesafe.ai')

    fireEvent.change(input, { target: { value: 'http://localhost:8000/' } })
    fireEvent.blur(input)
    expect(setJevBaseUrl).toHaveBeenCalledWith('http://localhost:8000')
  })

  it('keeps the previous value and flags the field when the URL is rejected', () => {
    const setJevBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" setJevBaseUrl={setJevBaseUrl} />)
    const input = screen.getByPlaceholderText('https://api.typesafe.ai')

    fireEvent.change(input, { target: { value: 'https://evil.com' } })
    fireEvent.blur(input)

    expect(setJevBaseUrl).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('restores the draft when the stored value is replaced externally', () => {
    const { rerender } = render(
      <AiHarnessSettingsPanel {...defaultProps} provider="jev" jevBaseUrl="https://api.typesafe.ai" />,
    )
    fireEvent.change(screen.getByPlaceholderText('https://api.typesafe.ai'), { target: { value: 'edited' } })

    rerender(
      <AiHarnessSettingsPanel {...defaultProps} provider="jev" jevBaseUrl="http://localhost:8000" />,
    )
    expect((screen.getByPlaceholderText('https://api.typesafe.ai') as HTMLInputElement).value).toBe(
      'http://localhost:8000',
    )
  })

  it('defaults the local inference device to CPU and allows WebGPU', () => {
    render(
      <AiHarnessSettingsPanel
        {...defaultProps}
        provider="local"
        model="onnx-community/Qwen2.5-0.5B-Instruct"
      />,
    )
    const selects = screen.getAllByRole('combobox')
    const device = selects[selects.length - 1] as HTMLSelectElement
    expect(device.value).toBe('wasm')
    expect(Array.from(device.options).map((o) => o.value)).toEqual(['wasm', 'webgpu'])
  })

  it('associates the Jev base URL label with its input', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" />)
    const input = screen.getByLabelText('Jev API Base URL')
    expect(input.getAttribute('id')).toBe('field-jev-base-url')
  })

  it('describes the rejected base URL to assistive tech', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" />)
    const input = screen.getByLabelText('Jev API Base URL')
    expect(input.getAttribute('aria-describedby')).toBeNull()

    fireEvent.change(input, { target: { value: 'https://evil.com' } })
    fireEvent.blur(input)

    expect(input.getAttribute('aria-invalid')).toBe('true')
    const described = input.getAttribute('aria-describedby')
    expect(described).toBeTruthy()
    expect(document.getElementById(described as string)?.textContent).toMatch(/cloud host/i)
  })

  it('rejects a half-typed host through the real guard, not a stub', () => {
    const setJevBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" setJevBaseUrl={setJevBaseUrl} />)
    const input = screen.getByLabelText('Jev API Base URL')

    fireEvent.change(input, { target: { value: 'htt' } })
    fireEvent.blur(input)
    expect(setJevBaseUrl).not.toHaveBeenCalled()
  })

  it('names the active provider in the API key storage notice', () => {
    const { unmount } = render(<AiHarnessSettingsPanel {...defaultProps} provider="jev" />)
    expect(screen.getByText(/sent directly to TypeSafe Jev/)).toBeDefined()
    unmount()

    render(<AiHarnessSettingsPanel {...defaultProps} provider="openrouter" />)
    expect(screen.getByText(/sent directly to OpenRouter/)).toBeDefined()
  })

  it('does not nest the inference device Field inside the Engine Field', () => {
    render(
      <AiHarnessSettingsPanel
        {...defaultProps}
        provider="local"
        model="onnx-community/Qwen2.5-0.5B-Instruct"
      />,
    )
    // A nested Field renders a second <label> inside the Engine one, which is
    // invalid markup and let the Engine label focus the custom-model input.
    const fields = screen.getAllByTestId('field')
    const engineField = fields.find((f) => f.textContent?.startsWith('Engine'))
    const deviceField = fields.find((f) => f.textContent?.startsWith('Inference device'))
    expect(engineField).toBeDefined()
    expect(deviceField).toBeDefined()
    expect(engineField?.contains(deviceField as Node)).toBe(false)
  })
})
