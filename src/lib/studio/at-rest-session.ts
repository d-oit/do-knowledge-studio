/**
 * At-rest encryption flag and session key holder (ADR 048 prototype).
 *
 * The flag is default-off: absent, unreadable, or any value other than `'1'`
 * means encryption is off. The derived key is held in module memory only — it is
 * never written to localStorage, sessionStorage, IndexedDB, or the logger — so a
 * reload locks the workspace. Nothing in the app reads this yet; wiring it into
 * `canonical-storage.ts` is blocked on the ADR's exit criteria.
 */

import { logger } from '@/lib/logging/logger'
import { createAtRestSalt, deriveAtRestKey } from './at-rest-crypto'

/** Subsystem tag for at-rest logs. */
const log = logger.child({ area: 'store' })

/** localStorage key holding the off-by-default at-rest encryption flag. */
export const AT_REST_ENCRYPTION_FLAG_KEY = 'dks-at-rest-encryption'

/** The only enabling value; everything else is off. */
const FLAG_ENABLED_VALUE = '1'

let sessionKey: CryptoKey | null = null

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

/** Sets the flag. Storage failure is reported, never silently ignored. */
export const setAtRestEncryptionEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return
  try {
    if (enabled) {
      window.localStorage.setItem(AT_REST_ENCRYPTION_FLAG_KEY, FLAG_ENABLED_VALUE)
      return
    }
    window.localStorage.removeItem(AT_REST_ENCRYPTION_FLAG_KEY)
  } catch (error) {
    log.error('At-rest encryption flag could not be written', { error })
  }
}

/**
 * Derives and holds the corpus key for this session.
 *
 * @param passphrase - Never persisted or logged.
 * @param salt - The corpus salt; a fresh one is generated when omitted.
 */
export const unlockAtRestSession = async (
  passphrase: string,
  salt: Uint8Array = createAtRestSalt(),
): Promise<void> => {
  sessionKey = await deriveAtRestKey(passphrase, salt)
}

/** Drops the session key. The next unlock must re-derive it. */
export const lockAtRestSession = (): void => {
  sessionKey = null
}

/** Whether an unlocked corpus key exists in memory. */
export const hasAtRestSessionKey = (): boolean => sessionKey !== null

/** The in-memory key, or null when locked. */
export const getAtRestSessionKey = (): CryptoKey | null => sessionKey
