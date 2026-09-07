import type { ProviderId } from '@/lib/ai/types'
import { AppError, ErrorCode } from '@/lib/errors'
import { StoredSettingsSchema, type ValidatedStoredSettings } from '@/lib/studio/schema'

const LEGACY_STORAGE_KEY = 'dks-ai-settings'
const CRYPTO_KEY_STORAGE = 'dks-ai-enc-key'
const IDB_DATABASE_NAME = 'dks-ai-settings-db'
const IDB_STORE_NAME = 'settings'
const IDB_VERSION = 1
const SETTINGS_RECORD_KEY = 'ai-settings'
const MIGRATION_KEY = 'dks-ls-migrated-to-idb'

/** Supported AI provider identifiers. */
export type AIProvider = ProviderId

/** Persisted AI provider configuration. */
export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string
  augmentWithLocal: boolean
  ollamaCpuOnly: boolean
  allowWebResearch: boolean
  ollamaBaseUrl: string
}

/** Stored settings shape before decryption, validated by {@link StoredSettingsSchema}. */
export type StoredSettings = ValidatedStoredSettings

/** Default AI settings applied on first load. */
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

/**
 * ── AI Settings Threat Model & Security Architecture ───────────────────────
 *
 * 1. Storage Layers:
 *    - IndexedDB (`dks-ai-settings-db` / `settings` store): Persists AI settings
 *      (provider, model, local model flags) plus the API key credential. New
 *      writes store the credential as an AES-GCM encrypted value
 *      (`encryptedApiKey`). Records migrated from the legacy localStorage key
 *      are written through unchanged and may still carry a plaintext `apiKey`
 *      until the user re-enters the credential — both shapes are accepted by
 *      {@link StoredSettingsSchema}.
 *    - `sessionStorage` (`dks-ai-enc-key`): Holds the raw base64-encoded symmetric AES-GCM (256-bit)
 *      encryption key used to encrypt/decrypt API key credentials at rest.
 *
 * 2. Threat Model & Security Boundaries:
 *    - Session Lifecycle: `sessionStorage` is strictly scoped to the active browser tab/window.
 *      Closing the tab destroys the encryption key in `sessionStorage`.
 *    - Data at Rest: After a credential has been (re-)entered, an offline attacker inspecting
 *      the IndexedDB store after session termination sees only AES-GCM ciphertext without the
 *      key, preventing API key extraction from disk. Legacy plaintext `apiKey` records remain
 *      readable at rest until the credential is re-entered and re-encrypted.
 *    - In-Session Threat Boundary (XSS): Same-origin scripts executing in the active tab session
 *      can access `sessionStorage` and WebCrypto APIs. Imported CryptoKeys use `extractable: false`
 *      in memory, but `sessionStorage` retains the base64 seed key for page reloads within the same session.
 *    - Multi-Tab Isolation: `sessionStorage` is per-tab. Opening a new tab creates an isolated context
 *      where decryption fails gracefully unless key credentials are re-entered or transferred explicitly.
 */

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
    const parsed: unknown = JSON.parse(raw)
    const parseResult = StoredSettingsSchema.safeParse(parsed)
    if (!parseResult.success) {
      console.error('localStorage settings schema validation failed:', parseResult.error)
      return null
    }
    const stored = parseResult.data
    // Persist to IndexedDB
    await idbSet(SETTINGS_RECORD_KEY, stored)

    // Verify subsequent read-back from IndexedDB before marking migration complete
    const readBack = await idbGet<unknown>(SETTINGS_RECORD_KEY)
    const readBackResult = StoredSettingsSchema.safeParse(readBack)
    if (!readBackResult.success) {
      console.error('IndexedDB read-back validation failed after migration; preserving legacy storage')
      return null
    }

    // Mark migration done and clean up localStorage only after confirmed successful read-back
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return readBackResult.data
  } catch (error) {
    console.error('localStorage→IndexedDB migration failed:', error instanceof Error ? error.message : error)
    return null
  }
}

// ── Public API ───────────────────────────────────────────────────────

/** Load AI settings from IndexedDB, migrating from localStorage if needed. */
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

    const rawStored = await idbGet<unknown>(SETTINGS_RECORD_KEY)
    if (!rawStored) return DEFAULT_SETTINGS
    const parseResult = StoredSettingsSchema.safeParse(rawStored)
    if (!parseResult.success) {
      console.error('Failed to validate AI settings schema from IndexedDB:', parseResult.error)
      return DEFAULT_SETTINGS
    }
    return applyStoredSettings(parseResult.data)
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
    augmentWithLocal: stored.augmentWithLocal ?? true,
    ollamaCpuOnly: stored.ollamaCpuOnly ?? false,
    allowWebResearch: stored.allowWebResearch ?? false,
    ollamaBaseUrl: stored.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
  }
}

/** Persist AI settings to IndexedDB with encrypted API key. */
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
    const parseResult = StoredSettingsSchema.safeParse(toStore)
    if (!parseResult.success) {
      throw new AppError(ErrorCode.STORAGE_WRITE_FAILED, 'Invalid AI settings schema', { cause: parseResult.error })
    }
    await idbSet(SETTINGS_RECORD_KEY, parseResult.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to save AI settings:', message)
    throw new AppError(ErrorCode.STORAGE_WRITE_FAILED, message, { cause: error })
  }
}

/** Returns true — API keys are stored in session-scoped encrypted form. */
export function isSessionOnlyCredential(): boolean {
  return true
}

/** User-facing message explaining session-only credential storage. */
export function getSessionOnlyMessage(): string {
  return 'API key is encrypted and stored locally. The encryption key is session-only — it will be cleared when you close the tab.'
}

/** Return the API endpoint URL for a given provider. */
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
