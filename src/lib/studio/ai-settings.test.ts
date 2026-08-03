import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProviderEndpoint, loadAISettings, saveAISettings, isSessionOnlyCredential, getSessionOnlyMessage, resetIDBConnection } from './ai-settings'

// ── In-memory IndexedDB mock ─────────────────────────────────────────
// Uses a shared Map so that multiple openDB() calls within the same test
// return the same in-memory store.

const idbStores = new Map<string, Map<string, unknown>>()

function createMockIDBRequest(result?: unknown): IDBRequest {
  const req = { result: result ?? undefined, onsuccess: null as ((this: IDBRequest) => void) | null, onerror: null as ((this: IDBRequest) => void) | null, error: null }
  // Defer the callback so the caller has a chance to set req.onsuccess
  setTimeout(() => { if (req.onsuccess) req.onsuccess.call(req as unknown as IDBRequest) }, 0)
  return req as unknown as IDBRequest
}

function createObjectStore(name: string): {
  _get(key: string): unknown
  _set(key: string, value: unknown): void
  get(key: IDBValidKey): IDBRequest
  put(value: unknown, key?: IDBValidKey): IDBRequest
} {
  if (!idbStores.has(name)) idbStores.set(name, new Map())
  const store = idbStores.get(name)!
  return {
    _get: (key: string) => store.get(key),
    _set: (key: string, value: unknown) => { store.set(key, value) },
    get(key: IDBValidKey) { return createMockIDBRequest(store.get(key as string)) },
    put(value: unknown, key?: IDBValidKey) { if (key !== undefined) store.set(key as string, value); return createMockIDBRequest() },
  }
}

function installMockIDB() {
  idbStores.clear()

  const mockIDB = {
    open: vi.fn((_name: string, _version?: number) => {
      const storeName = 'settings' // matches IDB_STORE_NAME
      const idbStore = createObjectStore(storeName)

      const mockDB = {
        objectStoreNames: {
          contains: (n: string) => n === storeName,
          length: 1,
          item: (i: number) => i === 0 ? storeName : null,
          [Symbol.iterator]: function* () { yield storeName },
        } as unknown as DOMStringList,
        createObjectStore: (name: string) => createObjectStore(name),
        transaction: (_names: string | string[], _mode?: IDBTransactionMode) => {
          return {
            objectStore: (name: string) => {
              if (name === storeName) return idbStore
              return createObjectStore(name)
            },
          } as unknown as IDBTransaction
        },
      }

      const req = {
        result: mockDB as unknown as IDBDatabase,
        onupgradeneeded: null as ((e: unknown) => void) | null,
        onsuccess: null as ((this: IDBOpenDBRequest) => void) | null,
        onerror: null as ((this: IDBOpenDBRequest) => void) | null,
        error: null,
      }

      queueMicrotask(() => {
        if (req.onsuccess) req.onsuccess.call(req as unknown as IDBOpenDBRequest)
      })
      return req as unknown as IDBOpenDBRequest
    }),
    deleteDatabase: vi.fn(),
  }

  vi.stubGlobal('indexedDB', mockIDB)
  return mockIDB
}

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
    expect(msg).toContain('session-only')
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

    installMockIDB()
    resetIDBConnection()
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

    const importKeyCalls = importKeySpy.mock.calls
    expect(importKeyCalls.length).toBeGreaterThan(0)
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
    // Pre-seed localStorage with legacy data
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

  it('handles invalid JSON in localStorage during migration', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorageMock['dks-ai-settings'] = 'invalid json'

    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('openrouter')
    expect(loaded.model).toBe('openrouter/free')
    spy.mockRestore()
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

  it('cleans up localStorage after migration', async () => {
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: '',
    })

    await loadAISettings()

    // localStorage should be cleaned up
    expect(localStorageMock['dks-ai-settings']).toBeUndefined()
    // Migration flag should be set
    expect(localStorageMock['dks-ls-migrated-to-idb']).toBe('1')
  })

  it('skips migration if already migrated', async () => {
    // Mark as already migrated
    localStorageMock['dks-ls-migrated-to-idb'] = '1'
    // Legacy key still exists (should not be read)
    localStorageMock['dks-ai-settings'] = JSON.stringify({
      provider: 'ollama',
      model: 'old-model',
    })

    // IDB is empty, so should return defaults
    const loaded = await loadAISettings()
    expect(loaded.provider).toBe('openrouter')
    expect(loaded.model).toBe('openrouter/free')
  })

  it('persists encryptedApiKey to IndexedDB, not plain apiKey', async () => {
    const settings = {
      provider: 'openrouter' as const,
      model: 'openrouter/free',
      apiKey: 'secret-key-abc',
      augmentWithLocal: true,
      ollamaCpuOnly: false,
      allowWebResearch: false,
      ollamaBaseUrl: 'http://localhost:11434',
    }

    await saveAISettings(settings)
    const loaded = await loadAISettings()
    expect(loaded.apiKey).toBe('secret-key-abc')

    // Verify stored data has encryptedApiKey, not plain apiKey
    const stored = idbStores.get('settings')?.get('ai-settings') as Record<string, unknown> | undefined
    expect(stored).toBeDefined()
    expect(stored!.apiKey).toBeUndefined()
    expect(stored!.encryptedApiKey).toBeDefined()
    expect(stored!.encryptedApiKey).not.toBe('secret-key-abc')
  })
})
