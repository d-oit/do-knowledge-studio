import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProviderEndpoint, loadAISettings, saveAISettings } from './ai-settings'

describe('getProviderEndpoint', () => {
  it('returns OpenRouter endpoint', () => {
    expect(getProviderEndpoint('openrouter')).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('returns Ollama endpoint', () => {
    expect(getProviderEndpoint('ollama')).toBe('http://localhost:11434/api/chat')
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
})
