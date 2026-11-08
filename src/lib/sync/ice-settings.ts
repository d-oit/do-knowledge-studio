/**
 * Encrypted persistence for ICE server settings (#1052).
 *
 * TURN credentials are secrets: they authorize a relay that bills by traffic.
 * They get the same treatment as AI API keys (see `ai-settings.ts`) — AES-256-
 * GCM under a session-scoped key, stored in IndexedDB, never in localStorage,
 * never in an invite, QR code, URL or log (ADR 045).
 *
 * The whole list is encrypted rather than just the credential, so a stolen
 * IndexedDB copy cannot even reveal which relay a user depends on. A new
 * session cannot decrypt the record; `loadIceServerSettings` then falls back to
 * the deployment defaults from `NEXT_PUBLIC_ICE_SERVERS`.
 */
import { z } from 'zod'
import { AppError, ErrorCode } from '@/lib/errors'
import { logger } from '@/lib/logging/logger'
import { decryptSessionValue, encryptSessionValue } from '@/lib/studio/session-crypto'
import { DEFAULT_ICE_SERVERS, validateIceServers, type IceServerConfig } from './ice-config'

const log = logger.child({ area: 'sync' })

/** IndexedDB database holding encrypted sync settings. */
export const ICE_SETTINGS_DB_NAME = 'dks-ice-settings-db'
/** Object store inside {@link ICE_SETTINGS_DB_NAME}. */
export const ICE_SETTINGS_STORE_NAME = 'ice'
/** Schema version of {@link ICE_SETTINGS_DB_NAME}. */
const DB_VERSION = 1
/** Record key for the ICE server list. */
export const ICE_SETTINGS_RECORD_KEY = 'ice-servers'
/** `sessionStorage` key holding the raw AES-GCM key for this tab. */
const KEY_STORAGE = 'dks-ice-enc-key'
/** Marker so a plaintext record is never mistaken for ciphertext. */
const ICE_SETTINGS_FORMAT = 'dks-ice-settings'
/** Version of the stored envelope shape. */
const ICE_SETTINGS_FORMAT_VERSION = 1

const EncryptedIceSettingsSchema = z.object({
  format: z.literal(ICE_SETTINGS_FORMAT),
  formatVersion: z.literal(ICE_SETTINGS_FORMAT_VERSION),
  ciphertext: z.string().min(1),
})

/** Cache of the open database, reset by {@link resetIceSettingsForTests}. */
let databasePromise: Promise<IDBDatabase> | null = null

/** Drops the cached connection and session key (tests). */
export const resetIceSettingsForTests = (): void => {
  databasePromise?.then(
    (db) => db.close(),
    () => undefined,
  )
  databasePromise = null
  sessionStorage.removeItem(KEY_STORAGE)
}

/** Opens (and upgrades) the settings database. */
const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise !== null) return databasePromise
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ICE_SETTINGS_DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ICE_SETTINGS_STORE_NAME)) {
        db.createObjectStore(ICE_SETTINGS_STORE_NAME)
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        databasePromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Could not open the sync settings database'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('Sync settings upgrade is blocked by another open tab'))
    }
  })
  databasePromise = promise
  return promise
}

/** Reads one record; `undefined` when nothing was stored. */
const readRecord = async (): Promise<unknown> => {
  const db = await openDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<unknown>()
  const transaction = db.transaction(ICE_SETTINGS_STORE_NAME, 'readonly')
  const request = transaction.objectStore(ICE_SETTINGS_STORE_NAME).get(ICE_SETTINGS_RECORD_KEY)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB read aborted'))
  return promise
}

/** Writes the encrypted envelope in its own transaction. */
const writeRecord = async (value: unknown): Promise<void> => {
  const db = await openDatabase()
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const transaction = db.transaction(ICE_SETTINGS_STORE_NAME, 'readwrite')
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'))
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'))
  transaction.objectStore(ICE_SETTINGS_STORE_NAME).put(value, ICE_SETTINGS_RECORD_KEY)
  return promise
}

/**
 * Loads the configured ICE servers.
 *
 * Returns the environment defaults when nothing is stored, and also when the
 * stored record cannot be decrypted (the session key is gone) — a relay that
 * silently refuses to be used would be worse than one the user re-enters.
 * Never rejects.
 */
export const loadIceServerSettings = async (): Promise<IceServerConfig[]> => {
  if (typeof indexedDB === 'undefined' || typeof sessionStorage === 'undefined') {
    return [...DEFAULT_ICE_SERVERS]
  }
  try {
    const record = await readRecord()
    if (record === undefined) return [...DEFAULT_ICE_SERVERS]
    const parsed = EncryptedIceSettingsSchema.safeParse(record)
    if (!parsed.success) {
      log.warn('Stored ICE settings do not match the expected envelope; ignoring them')
      return [...DEFAULT_ICE_SERVERS]
    }
    const plaintext = await decryptSessionValue(parsed.data.ciphertext, KEY_STORAGE)
    if (plaintext === null) return [...DEFAULT_ICE_SERVERS]
    const servers = validateIceServers(JSON.parse(plaintext) as unknown)
    if (!servers.ok) {
      log.warn('Stored ICE settings failed validation; ignoring them', {
        codes: servers.issues.map((issue) => issue.code),
      })
      return [...DEFAULT_ICE_SERVERS]
    }
    return servers.servers
  } catch (error) {
    log.warn('Failed to load ICE settings; using deployment defaults', { error })
    return [...DEFAULT_ICE_SERVERS]
  }
}

/**
 * Persists ICE servers after the same validation the UI runs.
 *
 * @throws AppError(STORAGE_WRITE_FAILED) when the list is invalid or the write
 *   fails. Callers surface the message; the credential is never logged.
 */
export const saveIceServerSettings = async (servers: IceServerConfig[]): Promise<void> => {
  const validated = validateIceServers(servers)
  if (!validated.ok) {
    throw new AppError(
      ErrorCode.STORAGE_WRITE_FAILED,
      validated.issues[0]?.message ?? 'That ICE configuration is not valid.',
    )
  }
  try {
    const ciphertext = await encryptSessionValue(JSON.stringify(validated.servers), KEY_STORAGE)
    await writeRecord({ format: ICE_SETTINGS_FORMAT, formatVersion: ICE_SETTINGS_FORMAT_VERSION, ciphertext })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('Failed to save ICE settings', { error })
    throw new AppError(ErrorCode.STORAGE_WRITE_FAILED, message, { cause: error })
  }
}
