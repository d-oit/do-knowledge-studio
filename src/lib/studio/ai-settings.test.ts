import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProviderEndpoint, loadAISettings, saveAISettings, isSessionOnlyCredential, getSessionOnlyMessage } from './ai-settings'

describe('getProviderEndpoint', () => {
  it('returns OpenRouter endpoint', () => {
    expect(getProviderEndpoint('openrouter')).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('returns Ollama endpoint', () => {
    expect(getProviderEndpoint('ollama')).toBe('http://localhost:11434/api/chat')
  })
})

describe('isSessionOnlyCredential', () => {
  it('returns true', () => {
    expect(isSessionOnlyCredential()).toBe(true)
  })
})

describe('getSessionOnlyMessage', () => {
  it('returns a message about session-only storage', () => {
    const msg = getSessionOnlyMessage()
    expect(msg).toContain('session only')
    expect(msg.length).toBeGreaterThan(0)
  })
})

describe('ai-settings encryption and persistence', () => {
  let localStorageMock: Record<string, string> = {}
  let sessionStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    sessionStorageMock = {}

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => { localStorageMock[key] = value },
      removeItem: (key: string) => { delete localStorageMock[key] },
    })

    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => sessionStorageMock[key] || null,
      setItem: (key: string, value: string) => { sessionStorageMock[key] = value },
      removeItem: (key: string) => { delete sessionStorageMock[key] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('encrypts API key when saving and decrypts when loading', async () => {
    const settings = {
      provider: 'openrouter' as const,
      model: 'openrouter/free',
      apiKey: 'test-api-key-123456789',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }

    await saveAISettings(settings)

    // Verify localStorage has encryptedApiKey but not plain apiKey
    const rawSaved = localStorageMock['dks-ai-settings']
    expect(rawSaved).toBeDefined()
    const parsed = JSON.parse(rawSaved)
    expect(parsed.apiKey).toBeUndefined()
    expect(parsed.encryptedApiKey).toBeDefined()
    expect(parsed.encryptedApiKey).not.toBe('test-api-key-123456789')

    // Verify sessionStorage has the key stored (to allow reuse)
    expect(sessionStorageMock['dks-ai-enc-key']).toBeDefined()

    // Load settings and verify API key is correctly decrypted
    const loaded = await loadAISettings()
    expect(loaded.apiKey).toBe('test-api-key-123456789')
  })

  it('ensures that the key used is non-extractable in memory', async () => {
    const importKeySpy = vi.spyOn(crypto.subtle, 'importKey')

    const settings = {
      provider: 'openrouter' as const,
      model: 'openrouter/free',
      apiKey: 'another-secure-key',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }

    await saveAISettings(settings)

    // Find the call that produces the key used for crypt operations
    const importKeyCalls = importKeySpy.mock.calls
    // The keys returned by importKey used for encrypt/decrypt should have extractable as false (the 4th argument)
    expect(importKeyCalls.length).toBeGreaterThan(0)
    // The final keys used for operations (not keyMaterial) are imported with GCM and extractable=false
    const finalKeyImports = importKeyCalls.filter(call => {
      const algorithm = call[2]
      return typeof algorithm === 'object' && algorithm.name === 'AES-GCM'
    })
    expect(finalKeyImports.length).toBeGreaterThan(0)
    for (const call of finalKeyImports) {
      expect(call[3]).toBe(false) // extractable should be false
    }
  })

  it('returns default settings when no stored settings', async () => {
    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('openrouter')
    expect(loaded.model).toBe('openrouter/free')
    expect(loaded.apiKey).toBe('')
  })

  it('migrates old provider names to valid providers', async () => {
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'invalid-provider',
      model: 'some-model',
    })

    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('openrouter')
  })

  it('migrates old OpenRouter model names', async () => {
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'openrouter',
      model: 'gpt-4o',
    })

    const loaded = await loadAISettings()
    expect(loaded.model).toBe('openrouter/free')
  })

  it('migrates claude model names', async () => {
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'openrouter',
      model: 'claude-3-opus',
    })

    const loaded = await loadAISettings()
    expect(loaded.model).toBe('anthropic/claude-3-opus')
  })

  it('handles empty API key', async () => {
    const settings = {
      provider: 'openrouter' as const,
      model: 'openrouter/free',
      apiKey: '',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }

    await saveAISettings(settings)
    const loaded = await loadAISettings()
    expect(loaded.apiKey).toBe('')
  })

  it('handles invalid JSON in localStorage', async () => {
    localStorageMock['dks-ai-settings'] = 'invalid json'

    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('openrouter')
    expect(loaded.model).toBe('openrouter/free')
  })

  it('preserves all settings fields', async () => {
    const settings = {
      provider: 'ollama' as const,
      model: 'llama3',
      apiKey: '',
      augmentWithLocal: false,
      ollamaCpuOnly: true,
      allowWebResearch: true,
      ollamaBaseUrl: 'http://localhost:11434',
    }

    await saveAISettings(settings)
    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('ollama')
    expect(loaded.model).toBe('llama3')
    expect(loaded.augmentWithLocal).toBe(false)
    expect(loaded.ollamaCpuOnly).toBe(true)
    expect(loaded.allowWebResearch).toBe(true)
    expect(loaded.ollamaBaseUrl).toBe('http://localhost:11434')
  })

  it('handles missing optional fields in stored settings', async () => {
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'ollama',
      model: 'llama3',
    })

    const loaded = await loadAISettings()
    expect(loaded.ollamaCpuOnly).toBe(false)
    expect(loaded.allowWebResearch).toBe(false)
    expect(loaded.ollamaBaseUrl).toBe('http://localhost:11434')
  })
})
