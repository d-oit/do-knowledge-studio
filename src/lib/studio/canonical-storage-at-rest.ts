/**
 * Record codec between the canonical Zustand envelope and its at-rest form
 * (ADR 048, issue #1162).
 *
 * The persistence adapter and the revision store both need the same answers to
 * the same questions, and getting them subtly different is how a plaintext
 * fallback ships. They live here:
 *
 * - When is a record encrypted? Whenever a session key exists. During the
 *   enable migration the key exists before the flag does, so key presence (not
 *   the flag) decides the write shape.
 * - When is a plaintext record acceptable? Only while the workspace is not
 *   encrypted. With the flag on, a plaintext record is refused — never
 *   hydrated, never rewritten, never deleted by this module.
 * - What does a failed read look like? A discriminated failure with no value,
 *   so a caller cannot accidentally use `undefined` as a corpus.
 *
 * Nothing here writes storage; it only converts and verifies values.
 */
import type { StorageValue } from 'zustand/middleware'
import {
  type AtRestEnvelope,
  type AtRestFailureReason,
  decryptAtRestWithKey,
  encryptAtRestWithKey,
  isAtRestEnvelope,
} from './at-rest-crypto'
import {
  getAtRestSessionKey,
  getAtRestSessionSalt,
  isAtRestEncryptionEnabled,
} from './at-rest-session'

/** Why a stored canonical record produced no usable value. */
export type AtRestStorageFailure = 'locked' | 'plaintext' | 'shape' | AtRestFailureReason

/** Decoded canonical record, or the reason it was refused. */
export type CanonicalRecordOutcome =
  | {
      ok: true
      value: StorageValue<unknown>
      /** Exact bytes to preserve in quarantine; ciphertext when encrypted. */
      quarantineRaw: string
    }
  | {
      ok: false
      failure: AtRestStorageFailure
      message: string
      /** Never plaintext while encryption is enabled — see ADR 048 §5. */
      quarantineRaw: string | null
    }

/** Raised when a write would have to store plaintext in an locked workspace. */
export class AtRestWriteBlockedError extends Error {
  constructor(message = 'the encrypted workspace is locked') {
    super(message)
    this.name = 'AtRestWriteBlockedError'
  }
}

/** Narrows a structured-cloned value to a Zustand `{ state, version }`. */
export const asStorageValue = (candidate: unknown): StorageValue<unknown> | null => {
  if (typeof candidate !== 'object' || candidate === null) return null
  if (!('state' in candidate)) return null
  const state = (candidate as { state: unknown }).state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return null
  return candidate as StorageValue<unknown>
}

/** Human-readable message for a refusal, safe to show in the UI. */
const refusalMessage = (failure: AtRestStorageFailure, detail?: string): string => {
  switch (failure) {
    case 'locked':
      return 'this workspace is encrypted and locked; unlock it to read your library'
    case 'plaintext':
      return 'the stored library is not encrypted, but encryption is enabled for this workspace'
    case 'version':
      return `the stored library uses an unsupported encrypted format${detail ? ` (${detail})` : ''}`
    case 'format':
      return `the stored library has an invalid encrypted envelope${detail ? ` (${detail})` : ''}`
    case 'shape':
      return 'the decrypted record is not a { state, version } envelope'
    case 'decrypt':
      return 'the stored library could not be decrypted; it was tampered with or the key is wrong'
  }
}

/**
 * Converts a stored record into a canonical envelope value.
 *
 * Fails closed on every encryption path. The returned `quarantineRaw` is the
 * exact record (ciphertext when encrypted) so the refusal path can preserve it
 * without ever re-reading a possibly-changed record.
 */
export const decodeCanonicalRecord = async (
  record: unknown,
): Promise<CanonicalRecordOutcome> => {
  if (isAtRestEnvelope(record)) {
    const key = getAtRestSessionKey()
    if (key === null) {
      return {
        ok: false,
        failure: 'locked',
        message: refusalMessage('locked'),
        quarantineRaw: JSON.stringify(record),
      }
    }
    const outcome = await decryptAtRestWithKey(record, key)
    if (!outcome.ok) {
      return {
        ok: false,
        failure: outcome.reason,
        message: refusalMessage(outcome.reason, outcome.message),
        quarantineRaw: JSON.stringify(record),
      }
    }
    const value = asStorageValue(outcome.value)
    if (value === null) {
      return {
        ok: false,
        failure: 'shape',
        message: refusalMessage('shape'),
        quarantineRaw: JSON.stringify(record),
      }
    }
    return { ok: true, value, quarantineRaw: JSON.stringify(record) }
  }

  // An unencrypted record while encryption is enabled is the one case this
  // module refuses to make readable: hydrating it would silently defeat the
  // setting, and rewriting it would destroy the bytes the user could still
  // recover from an older build.
  if (isAtRestEncryptionEnabled()) {
    return {
      ok: false,
      failure: 'plaintext',
      message: refusalMessage('plaintext'),
      quarantineRaw: null,
    }
  }

  const value = asStorageValue(record)
  if (value === null) {
    return {
      ok: false,
      failure: 'shape',
      message: refusalMessage('shape'),
      quarantineRaw: typeof record === 'string' ? record : JSON.stringify(record),
    }
  }
  return { ok: true, value, quarantineRaw: JSON.stringify(value) }
}

/**
 * Converts a canonical envelope value into the record to store.
 *
 * Encrypts whenever a session key is held, which is what makes the enable
 * migration possible (key first, flag second). Throws rather than returning
 * plaintext when the flag is on but the key is missing: a caller that ignores
 * the throw must not be handed a fallback.
 */
export const encodeCanonicalRecord = async (
  value: StorageValue<unknown>,
): Promise<StorageValue<unknown> | AtRestEnvelope> => {
  const key = getAtRestSessionKey()
  if (key === null) {
    if (isAtRestEncryptionEnabled()) throw new AtRestWriteBlockedError()
    return value
  }
  const salt = getAtRestSessionSalt()
  if (salt === null) throw new Error('the at-rest session key has no corpus salt')
  return encryptAtRestWithKey(value, key, salt)
}

/**
 * Whether what came back out of storage is the value that went in.
 *
 * Encrypted records are decrypted and compared structurally, so a stored-but-
 * truncated ciphertext cannot pass as a successful migration.
 */
export const verifyCanonicalRecord = async (
  value: StorageValue<unknown>,
  readBack: unknown,
): Promise<boolean> => {
  if (isAtRestEnvelope(readBack)) {
    const key = getAtRestSessionKey()
    if (key === null) return false
    const outcome = await decryptAtRestWithKey(readBack, key)
    return outcome.ok && sameJson(outcome.value, value)
  }
  return sameJson(readBack, value)
}

/** Deep structural comparison used by every read-back verification. */
export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * SHA-256 of a canonical envelope, as hex.
 *
 * This is the corpus fingerprint the migration records: the same value before
 * and after encryption proves the readable corpus did not change. It is a
 * digest of content, not a key, and it is never used for authentication.
 */
export const corpusFingerprint = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
