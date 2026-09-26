import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'
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
  DEFAULT_LOCAL_MODELS: [{ id: 'onnx-community/Qwen2.5-0.5B-Instruct', displayName: 'Qwen2.5 0.5B Instruct', dtype: 'q4' }],
  LOCAL_PROVIDER_ID: 'local',
  // The real guard, not a no-op: a stub that accepted any host would let these
  // tests pass while the shipped code rejected the value.
  validateOllamaUrl: (u: string) => {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Ollama base URL must use http or https protocol')
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) && !parsed.hostname.endsWith('.local')) {
      throw new Error('Ollama base URL must point to localhost or a .local hostname')
    }
    return u.replace(/\/+$/, '')
  },
}))

vi.mock('@/lib/ai/types', () => ({
  DEFAULT_MODEL: { openrouter: 'openrouter/free', ollama: 'llama3', local: 'onnx-community/Qwen2.5-0.5B-Instruct' },
  DEFAULT_OLLAMA_BASE_URL: 'http://localhost:11434',
}))

vi.mock('./ai-harness-settings', () => ({
  PROVIDERS: [
    { id: 'openrouter', label: 'OpenRouter', models: ['openrouter/free'], requiresKey: true },
    { id: 'ollama', label: 'Ollama (local)', models: ['llama3'], requiresKey: false },
    { id: 'local', label: 'Local (in-browser)', models: ['onnx-community/Qwen2.5-0.5B-Instruct'], requiresKey: false },
  ],
  // Mirrors the real Field, which renders a <label htmlFor> and injects the id
  // into its first native input child. A <span> here would make the
  // label-association test pass without any association existing.
  Field: ({ label, children }: { label: string; children?: ReactNode }) => {
    const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`
    return (
      <div data-testid="field">
        <label htmlFor={fieldId}>{label}</label>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: fieldId })
          : children}
      </div>
    )
  },
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
  localDevice: 'wasm' as const,
  setLocalDevice: vi.fn(),
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
  it('does not commit a half-typed base URL to settings', () => {
    const setOllamaBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" setOllamaBaseUrl={setOllamaBaseUrl} />)
    const input = screen.getByLabelText('Ollama Base URL')

    // Autosave runs on every keystroke, so a partial host must stay local to
    // the input rather than reaching the settings writer.
    fireEvent.change(input, { target: { value: 'htt' } })
    expect(setOllamaBaseUrl).not.toHaveBeenCalled()

    fireEvent.blur(input)
    expect(setOllamaBaseUrl).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('commits the normalized base URL on blur', () => {
    const setOllamaBaseUrl = vi.fn()
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" setOllamaBaseUrl={setOllamaBaseUrl} />)
    const input = screen.getByLabelText('Ollama Base URL')

    fireEvent.change(input, { target: { value: 'http://localhost:11434/' } })
    fireEvent.blur(input)
    expect(setOllamaBaseUrl).toHaveBeenCalledWith('http://localhost:11434')
  })

  it('associates the base URL label with its input', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" />)
    // Asserts the real htmlFor -> id relationship, not just that an id exists.
    const input = screen.getByLabelText('Ollama Base URL')
    expect(input.tagName).toBe('INPUT')
    expect(document.querySelector('label[for="field-ollama-base-url"]')?.textContent).toBe(
      'Ollama Base URL',
    )
  })

  it('keeps an in-progress edit when hydration lands mid-edit', () => {
    // The panel mounts before loadAISettings() resolves, so a URL typed in
    // that window must survive the stored value arriving.
    const { rerender } = render(
      <AiHarnessSettingsPanel {...defaultProps} provider="ollama" ollamaBaseUrl="http://localhost:11434" />,
    )
    fireEvent.change(screen.getByLabelText('Ollama Base URL'), {
      target: { value: 'http://my-host.local:11434' },
    })

    rerender(
      <AiHarnessSettingsPanel {...defaultProps} provider="ollama" ollamaBaseUrl="http://127.0.0.1:11434" />,
    )

    expect((screen.getByLabelText('Ollama Base URL') as HTMLInputElement).value).toBe(
      'http://my-host.local:11434',
    )
  })

  it('adopts an externally restored value when the field is untouched', () => {
    const { rerender } = render(
      <AiHarnessSettingsPanel {...defaultProps} provider="ollama" ollamaBaseUrl="http://localhost:11434" />,
    )

    rerender(
      <AiHarnessSettingsPanel {...defaultProps} provider="ollama" ollamaBaseUrl="http://127.0.0.1:11434" />,
    )

    expect((screen.getByLabelText('Ollama Base URL') as HTMLInputElement).value).toBe(
      'http://127.0.0.1:11434',
    )
  })

  it('describes a rejected base URL to assistive tech', () => {
    render(<AiHarnessSettingsPanel {...defaultProps} provider="ollama" />)
    const input = screen.getByLabelText('Ollama Base URL')
    fireEvent.change(input, { target: { value: 'https://evil.com' } })
    fireEvent.blur(input)

    const described = input.getAttribute('aria-describedby')
    expect(described).toBeTruthy()
    expect(document.getElementById(described as string)?.textContent).toMatch(/localhost/i)
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
})
