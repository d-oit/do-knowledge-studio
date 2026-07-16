import type { ProviderId } from '@/lib/ai/types'

const STORAGE_KEY = 'dks-ai-settings'
const CRYPTO_KEY_STORAGE = 'dks-ai-enc-key'

export type AIProvider = ProviderId

export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string
  augmentWithLocal: boolean
  ollamaCpuOnly: boolean
  allowWebResearch: boolean
  ollamaBaseUrl: string
}

interface StoredSettings {
  provider: string
  model: string
  encryptedApiKey?: string
  apiKey?: string
  augmentWithLocal: boolean
  ollamaCpuOnly?: boolean
  allowWebResearch?: boolean
  ollamaBaseUrl?: string
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'ollama',
  model: 'llama3',
  apiKey: '',
  augmentWithLocal: true,
  ollamaCpuOnly: false,
  allowWebResearch: false,
  ollamaBaseUrl: 'http://localhost:11434',
}

function migrateProvider(stored: StoredSettings): AIProvider {
  if (stored.provider === 'openrouter' || stored.provider === 'ollama') {
    return stored.provider as AIProvider
  }
  return 'openrouter'
}

function migrateModel(provider: AIProvider, storedModel: string): string {
  if (provider === 'openrouter') {
    if (storedModel === 'gpt-4o' || storedModel === 'gpt-4o-mini' || storedModel === 'gpt-3.5-turbo') {
      return 'openrouter/free'
    }
    if (storedModel.startsWith('claude-')) {
      return `anthropic/${storedModel}`
    }
  }
  return storedModel
}

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(CRYPTO_KEY_STORAGE)
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
  sessionStorage.setItem(CRYPTO_KEY_STORAGE, b64)
  return key
}

async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey) return ''
  const key = await getOrCreateEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(apiKey)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return ''
  try {
    const key = await getOrCreateEncryptionKey()
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Failed to decrypt API key:', error instanceof Error ? error.message : error)
    return ''
  }
}

export async function loadAISettings(): Promise<AISettings> {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const stored = JSON.parse(raw) as StoredSettings
    const provider = migrateProvider(stored)
    const model = migrateModel(provider, stored.model)
    const apiKey = stored.encryptedApiKey
      ? await decryptApiKey(stored.encryptedApiKey)
      : (stored.apiKey ?? '')
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      provider,
      model,
      apiKey,
      ollamaCpuOnly: stored.ollamaCpuOnly ?? false,
      allowWebResearch: stored.allowWebResearch ?? false,
      ollamaBaseUrl: stored.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
    }
  } catch (error) {
    console.error('Failed to load AI settings:', error instanceof Error ? error.message : error)
    return DEFAULT_SETTINGS
  }
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const encryptedApiKey = await encryptApiKey(settings.apiKey)
    const toStore: StoredSettings = {
      provider: settings.provider,
      model: settings.model,
      encryptedApiKey,
      augmentWithLocal: settings.augmentWithLocal,
      ollamaCpuOnly: settings.ollamaCpuOnly,
      allowWebResearch: settings.allowWebResearch,
      ollamaBaseUrl: settings.ollamaBaseUrl,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch (error) {
    console.error('Failed to save AI settings:', error instanceof Error ? error.message : error)
  }
}

export function getProviderEndpoint(provider: AIProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions'
    case 'ollama':
      return 'http://localhost:11434/api/chat'
  }
}
