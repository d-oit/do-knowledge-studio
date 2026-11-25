/**
 * Logging half of #1162 acceptance criterion 2: the encryption lifecycle must
 * never log the passphrase or raw key bytes.
 *
 * The logger is replaced with a recorder for this file only, so the assertions
 * see arguments exactly as the call sites passed them — before the logger's own
 * key-name redaction (`passphrase`, `key`, ...) could hide a payload. A forced
 * enable failure also requires the recorder to contain the real rollback log,
 * so an empty call list cannot make the test pass vacuously (LESSON-046).
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** One logger call with the untransformed arguments the app passed. */
interface RecordedLogCall {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, unknown>
}

const { recorded } = vi.hoisted(() => ({ recorded: [] as RecordedLogCall[] }))

/**
 * Replaces every `logger`/`createLogger` consumer with one shared recorder.
 * Modules capture `logger.child()` at import time, so the mock must be in place
 * before they are imported — `vi.mock` hoisting does that.
 */
vi.mock('@/lib/logging/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/logger')>()
  const record =
    (level: RecordedLogCall['level']) =>
    (message: string, data?: Record<string, unknown>): void => {
      recorded.push(data === undefined ? { level, message } : { level, message, data })
    }
  const recording: import('@/lib/logging/logger').Logger = {
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    child: () => recording,
  }
  return { ...actual, logger: recording, createLogger: () => recording }
})

import { AT_REST_KDF_ITERATIONS, AT_REST_KEY_BITS } from './at-rest-crypto'
import {
  AT_REST_ENCRYPTION_FLAG_KEY,
  AT_REST_SALT_KEY,
  getAtRestSessionStatus,
  isAtRestEncryptionEnabled,
  lockAtRestSession,
  readAtRestSalt,
} from './at-rest-session'
import { enableWorkspaceEncryption, unlockWorkspace } from './at-rest-workspace'
import { resetCanonicalStorageForTests } from './canonical-storage'
import { readIndexedRawRecord } from './canonical-storage-idb'
import { recordHydrationRefusal } from './hydration-guard'

const PASSPHRASE = 'correct horse battery staple'
const WRONG_PASSPHRASE = 'this is not the passphrase'

/** Hex rendering of bytes, the form a key would leak as in a message. */
const hexOf = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

/** Base64 rendering of bytes. */
const base64Of = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))

/** Unpadded base64url rendering of bytes. */
const base64UrlOf = (bytes: Uint8Array): string =>
  base64Of(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

/** Decodes base64 written by the app, for capturing a salt mid-migration. */
const decodeBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

/**
 * Derives the same raw AES key bytes the app's non-extractable `CryptoKey`
 * holds, so the test can search every log for that exact byte sequence.
 */
const deriveKeyBytes = async (salt: Uint8Array): Promise<Uint8Array> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: AT_REST_KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    AT_REST_KEY_BITS,
  )
  return new Uint8Array(bits)
}

/** JSON rendering that expands binary values instead of stringifying to `{}`. */
const describeValue = (value: unknown): string => {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_key: string, item: unknown) => {
    if (typeof item === 'bigint') return item.toString()
    if (item instanceof ArrayBuffer) return Array.from(new Uint8Array(item))
    if (ArrayBuffer.isView(item)) {
      const view = item as Uint8Array
      return Array.from(new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength))
    }
    if (item instanceof Error) return `${item.name}: ${item.message}`
    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) return '[Circular]'
      seen.add(item)
    }
    return item
  })
}

/** Every value nested inside a logged payload, for structural assertions. */
const flattenValues = (value: unknown, into: unknown[] = []): unknown[] => {
  into.push(value)
  if (value === null || typeof value !== 'object') return into
  if (value instanceof Error || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return into
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    flattenValues(nested, into)
  }
  return into
}

/**
 * Asserts that no recorded call carries the passphrase (right or wrong) or the
 * key bytes derived from `salt`, in any of the encodings a leak could use, and
 * that no payload carries a `CryptoKey` object at all.
 */
const expectNoSecretsInLogs = async (salt: Uint8Array | null): Promise<void> => {
  const forbidden = [PASSPHRASE, WRONG_PASSPHRASE]
  if (salt !== null) {
    const keyBytes = await deriveKeyBytes(salt)
    forbidden.push(
      hexOf(keyBytes),
      base64Of(keyBytes),
      base64UrlOf(keyBytes),
      JSON.stringify(Array.from(keyBytes)),
    )
  }

  for (const call of recorded) {
    const rendered = `${call.message}\n${describeValue(call.data)}`
    for (const secret of forbidden) {
      expect(rendered, `${call.level} log "${call.message}" carried a secret`).not.toContain(
        secret,
      )
    }
  }

  const cryptoKeys = recorded
    .flatMap((call) => flattenValues(call.data))
    .filter((value) => typeof CryptoKey !== 'undefined' && value instanceof CryptoKey)
  expect(cryptoKeys).toHaveLength(0)
}

describe('at-rest encryption logging', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await resetCanonicalStorageForTests()
    lockAtRestSession()
    recorded.length = 0
  })

  it('logs neither the passphrase nor key bytes during enable, unlock or a wrong-passphrase refusal', async () => {
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const salt = readAtRestSalt()
    expect(salt).not.toBeNull()
    expect(isAtRestEncryptionEnabled()).toBe(true)
    expect(getAtRestSessionStatus()).toBe('unlocked')

    lockAtRestSession()
    expect((await unlockWorkspace(PASSPHRASE)).ok).toBe(true)

    lockAtRestSession()
    expect((await unlockWorkspace(WRONG_PASSPHRASE)).ok).toBe(false)
    expect(getAtRestSessionStatus()).toBe('locked')

    await expectNoSecretsInLogs(salt)
  })

  it('logs neither the passphrase nor key bytes while resuming an interrupted setup', async () => {
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const salt = readAtRestSalt()
    expect(salt).not.toBeNull()
    const encryptedRaw = JSON.stringify(await readIndexedRawRecord())

    // A tab killed after the ciphertext landed but before the settings were
    // written: the next page load latches hydration (and writes) off.
    lockAtRestSession()
    localStorage.removeItem(AT_REST_ENCRYPTION_FLAG_KEY)
    localStorage.removeItem(AT_REST_SALT_KEY)
    recordHydrationRefusal('the workspace is locked', null, true)
    recorded.length = 0

    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    expect(JSON.stringify(await readIndexedRawRecord())).toBe(encryptedRaw)

    await expectNoSecretsInLogs(salt)
  })

  it('records the real rollback log of a failed enable and finds no secrets in any call', async () => {
    const observed: { salt: Uint8Array | null } = { salt: null }
    // The test setup provides `localStorage` as a plain mock object, so the
    // instance method is the seam here, not `Storage.prototype`.
    const originalSetItem = localStorage.setItem
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === AT_REST_SALT_KEY) observed.salt = decodeBase64(value)
      // Fail only the settings write, so the migration reaches its rollback path.
      if (key === AT_REST_ENCRYPTION_FLAG_KEY) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
      originalSetItem.call(localStorage, key, value)
    })

    try {
      expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(false)
    } finally {
      setItem.mockRestore()
    }

    expect(recorded.map((call) => call.message)).toContain(
      'Enabling workspace encryption failed; rolling back',
    )
    expect(observed.salt).not.toBeNull()
    expect(readAtRestSalt()).toBeNull()
    expect(isAtRestEncryptionEnabled()).toBe(false)

    await expectNoSecretsInLogs(observed.salt)
  })
})
