/**
 * At-rest encryption flag and in-memory corpus-key session (ADR 048).
 *
 * Three pieces of state live here, and only two of them are durable:
 *
 * - The enable flag (`dks-at-rest-encryption`), default-off. Absent,
 *   unreadable, or any value other than `'1'` means encryption is off.
 * - The corpus salt (`dks-at-rest-salt`), base64 bytes. A salt is not a secret:
 *   it exists so the same passphrase derives the same key on every reload. It
 *   is public input to PBKDF2, never the key.
 * - The derived key, which is module memory only. It is never written to
 *   localStorage, sessionStorage, IndexedDB, or the logger, so a reload locks
 *   the workspace.
 *
 * Locking drops the key and notifies subscribers. Nothing here imports the
 * store or the persistence adapter, so both can depend on it without a cycle.
 */

import { logger } from '@/lib/logging/logger'
import { AT_REST_SALT_BYTES, createAtRestSalt, deriveAtRestKey } from './at-rest-crypto'

/** Subsystem tag for at-rest logs. */
const log = logger.child({ area: 'store' })

/** localStorage key holding the off-by-default at-rest encryption flag. */
export const AT_REST_ENCRYPTION_FLAG_KEY = 'dks-at-rest-encryption'
/** localStorage key holding the public corpus salt. Never holds key material. */
export const AT_REST_SALT_KEY = 'dks-at-rest-salt'

/** The only enabling value; everything else is off. */
const FLAG_ENABLED_VALUE = '1'

/** Whether the workspace is encrypted-and-open, encrypted-and-locked, or plain. */
export type AtRestSessionStatus = 'off' | 'locked' | 'unlocked'

let sessionKey: CryptoKey | null = null
let sessionSalt: Uint8Array | null = null
const sessionListeners = new Set<() => void>()

/** Notifies every listener; a throwing listener cannot stop the others. */
const notifySession = (): void => {
  for (const listener of sessionListeners) {
    try {
      listener()
    } catch (error) {
      log.error('At-rest session listener failed', { error })
    }
  }
}

/** Subscribes to lock/unlock/flag changes; returns an unsubscribe function. */
export const subscribeToAtRestSession = (listener: () => void): (() => void) => {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

/**
 * Whether at-rest encryption is requested for this origin.
 *
 * Storage failure means "off": a flag that cannot be read must not turn on a
 * code path the user did not ask for.
 */
export const isAtRestEncryptionEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(AT_REST_ENCRYPTION_FLAG_KEY) === FLAG_ENABLED_VALUE
  } catch (error) {
    log.warn('At-rest encryption flag could not be read; treating it as off', { error })
    return false
  }
}

/**
 * Sets the flag. Returns whether the write landed: the caller is mid-migration
 * and must not report success when the next reload would come up plaintext.
 */
export const setAtRestEncryptionEnabled = (enabled: boolean): boolean => {
  if (typeof window === 'undefined') return false
  try {
    if (enabled) {
      window.localStorage.setItem(AT_REST_ENCRYPTION_FLAG_KEY, FLAG_ENABLED_VALUE)
    } else {
      window.localStorage.removeItem(AT_REST_ENCRYPTION_FLAG_KEY)
    }
    notifySession()
    return true
  } catch (error) {
    log.error('At-rest encryption flag could not be written', { error })
    return false
  }
}

/** Encodes bytes as base64 without Buffer (browser + jsdom). */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Decodes base64 into bytes; throws on malformed input. */
const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/**
 * Reads the public corpus salt, or null when absent or malformed.
 *
 * A wrong-length salt is treated as absent: deriving from it would produce a
 * key that cannot open the corpus, and guessing is worse than refusing.
 */
export const readAtRestSalt = (): Uint8Array | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AT_REST_SALT_KEY)
    if (raw === null) return null
    const salt = fromBase64(raw)
    if (salt.length !== AT_REST_SALT_BYTES) {
      log.warn('At-rest corpus salt has an unexpected length; ignoring it')
      return null
    }
    return salt
  } catch (error) {
    log.warn('At-rest corpus salt could not be read', { error })
    return null
  }
}

/** Persists the public corpus salt. Returns whether the write landed. */
export const writeAtRestSalt = (salt: Uint8Array): boolean => {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(AT_REST_SALT_KEY, toBase64(salt))
    return true
  } catch (error) {
    log.error('At-rest corpus salt could not be written', { error })
    return false
  }
}

/** Removes the corpus salt; only correct once the corpus is plaintext again. */
export const clearAtRestSalt = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AT_REST_SALT_KEY)
  } catch (error) {
    log.warn('At-rest corpus salt could not be removed', { error })
  }
}

/**
 * Installs an already-derived key (and its public salt) for this session.
 *
 * Used by the enable flow, which derives the key from a fresh salt before any
 * envelope exists.
 */
export const installAtRestSessionKey = (key: CryptoKey, salt: Uint8Array): void => {
  sessionKey = key
  sessionSalt = salt
  notifySession()
}

/**
 * Derives and holds the corpus key for this session.
 *
 * @param passphrase - Never persisted or logged.
 * @param salt - The corpus salt; the persisted one is used when omitted, and a
 *   fresh one is generated (and persisted) only when none exists yet.
 */
export const unlockAtRestSession = async (
  passphrase: string,
  salt?: Uint8Array,
): Promise<void> => {
  const resolved = salt ?? readAtRestSalt() ?? createAtRestSalt()
  const key = await deriveAtRestKey(passphrase, resolved)
  installAtRestSessionKey(key, resolved)
}

/** Drops the session key. The next unlock must re-derive it. */
export const lockAtRestSession = (): void => {
  sessionKey = null
  sessionSalt = null
  notifySession()
}

/** Whether an unlocked corpus key exists in memory. */
export const hasAtRestSessionKey = (): boolean => sessionKey !== null

/** The in-memory key, or null when locked. */
export const getAtRestSessionKey = (): CryptoKey | null => sessionKey

/** The in-memory corpus salt, or null when locked. */
export const getAtRestSessionSalt = (): Uint8Array | null => sessionSalt

/** The session's encryption state, for the UI and the lock gate. */
export const getAtRestSessionStatus = (): AtRestSessionStatus => {
  if (!isAtRestEncryptionEnabled()) return 'off'
  return sessionKey === null ? 'locked' : 'unlocked'
}
