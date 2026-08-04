import type { ProviderId } from '@/lib/ai/types'
import { AppError, ErrorCode } from '@/lib/errors'

const LEGACY_STORAGE_KEY = 'dks-ai-settings'
const CRYPTO_KEY_STORAGE = 'dks-ai-enc-key'
const IDB_DATABASE_NAME = 'dks-ai-settings-db'
const IDB_STORE_NAME = 'settings'
const IDB_VERSION = 1
const SETTINGS_RECORD_KEY = 'ai-settings'
const MIGRATION_KEY = 'dks-ls-migrated-to-idb'

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
  provider: 'openrouter',
  model: 'openrouter/free',
  apiKey: '',
  augmentWithLocal: true,
  ollamaCpuOnly: false,
  allowWebResearch: false,
  ollamaBaseUrl: 'http://localhost:11434',
}

// ── IndexedDB helpers ────────────────────────────────────────────────

let idbPromise: Promise<IDBDatabase> | null = null

/** Reset cached IDB connection. Used by tests to isolate between test cases. */
export function resetIDBConnection(): void {
  idbPromise = null
}

function openDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DATABASE_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME)
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        idbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      idbPromise = null // Reset on error so next call retries
      reject(request.error)
    }
    request.onblocked = () => {
      idbPromise = null
      reject(new Error('IndexedDB upgrade blocked by another open tab'))
    }
  })
  return idbPromise
}

function idbGet<T>(key: IDBValidKey): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly')
        const store = tx.objectStore(IDB_STORE_NAME)
        const req = store.get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbSet(key: IDBValidKey, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
        const store = tx.objectStore(IDB_STORE_NAME)
        const req = store.put(value, key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      }),
  )
}

// ── Provider / model migrations (unchanged logic) ────────────────────

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

// ── Encryption (unchanged — sessionStorage for session-scoped key) ───

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(CRYPTO_KEY_STORAGE)
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
  sessionStorage.setItem(CRYPTO_KEY_STORAGE, b64)
  return crypto.subtle.importKey('raw', exported, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
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

// ── localStorage → IndexedDB migration ────────────────────────────────

async function migrateFromLocalStorage(): Promise<StoredSettings | null> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredSettings
    // Persist to IndexedDB
    await idbSet(SETTINGS_RECORD_KEY, stored)
    // Mark migration done and clean up localStorage
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return stored
  } catch (error) {
    console.error('localStorage→IndexedDB migration failed:', error instanceof Error ? error.message : error)
    return null
  }
}

// ── Public API ───────────────────────────────────────────────────────

export async function loadAISettings(): Promise<AISettings> {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    // First load: migrate any existing localStorage data into IndexedDB
    const alreadyMigrated = localStorage.getItem(MIGRATION_KEY) === '1'
    if (!alreadyMigrated) {
      const migrated = await migrateFromLocalStorage()
      if (migrated) {
        return applyStoredSettings(migrated)
      }
    }

    const stored = await idbGet<StoredSettings>(SETTINGS_RECORD_KEY)
    if (!stored) return DEFAULT_SETTINGS
    return applyStoredSettings(stored)
  } catch (error) {
    console.error('Failed to load AI settings:', error instanceof Error ? error.message : error)
    return DEFAULT_SETTINGS
  }
}

async function applyStoredSettings(stored: StoredSettings): Promise<AISettings> {
  const provider = migrateProvider(stored)
  const model = migrateModel(provider, stored.model)
  const apiKey = stored.encryptedApiKey
    ? await decryptApiKey(stored.encryptedApiKey)
    : (stored.apiKey ?? '')
  return {
    provider,
    model,
    apiKey,
    augmentWithLocal: stored.augmentWithLocal,
    ollamaCpuOnly: stored.ollamaCpuOnly ?? false,
    allowWebResearch: stored.allowWebResearch ?? false,
    ollamaBaseUrl: stored.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
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
    await idbSet(SETTINGS_RECORD_KEY, toStore)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to save AI settings:', message)
    throw new AppError(ErrorCode.STORAGE_WRITE_FAILED, message, { cause: error })
  }
}

export function isSessionOnlyCredential(): boolean {
  return true
}

export function getSessionOnlyMessage(): string {
  return 'API key is encrypted and stored locally. The encryption key is session-only — it will be cleared when you close the tab.'
}

export function getProviderEndpoint(provider: AIProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions'
    case 'ollama':
      return 'http://localhost:11434/api/chat'
    default:
      return ''
  }
}
