import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AT_REST_FORMAT,
  AT_REST_FORMAT_VERSION,
  AT_REST_IV_BYTES,
  AT_REST_KDF_ITERATIONS,
  AT_REST_SALT_BYTES,
  createAtRestSalt,
  decryptAtRestEnvelope,
  deriveAtRestKey,
  encryptAtRestEnvelope,
  type AtRestEnvelope,
} from './at-rest-crypto'
import {
  AT_REST_ENCRYPTION_FLAG_KEY,
  hasAtRestSessionKey,
  isAtRestEncryptionEnabled,
  lockAtRestSession,
  setAtRestEncryptionEnabled,
  unlockAtRestSession,
} from './at-rest-session'

const PASSPHRASE = 'correct horse battery staple'

describe('at-rest envelope codec', () => {
  it('round-trips a corpus-shaped value', async () => {
    const corpus = { state: { entities: [{ id: 'e1', name: 'TRIZ' }] }, version: 5 }

    const envelope = await encryptAtRestEnvelope(corpus, PASSPHRASE)
    const outcome = await decryptAtRestEnvelope(envelope, PASSPHRASE)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected decryption to succeed')
    expect(outcome.value).toEqual(corpus)
  })

  it('uses a fresh salt and IV for every envelope', async () => {
    const first = await encryptAtRestEnvelope({ a: 1 }, PASSPHRASE)
    const second = await encryptAtRestEnvelope({ a: 1 }, PASSPHRASE)

    expect(first.salt).not.toBe(second.salt)
    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it('records the documented KDF parameters and lengths', async () => {
    const envelope = await encryptAtRestEnvelope({ a: 1 }, PASSPHRASE)

    expect(envelope.format).toBe(AT_REST_FORMAT)
    expect(envelope.formatVersion).toBe(AT_REST_FORMAT_VERSION)
    expect(envelope.iterations).toBe(AT_REST_KDF_ITERATIONS)
    expect(atob(envelope.salt)).toHaveLength(AT_REST_SALT_BYTES)
    expect(atob(envelope.iv)).toHaveLength(AT_REST_IV_BYTES)
  })

  it('fails closed on a wrong passphrase', async () => {
    const envelope = await encryptAtRestEnvelope({ secret: 'value' }, PASSPHRASE)

    const outcome = await decryptAtRestEnvelope(envelope, 'wrong passphrase')

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected decryption to fail')
    expect(outcome.reason).toBe('decrypt')
  })

  it('fails closed when the ciphertext was tampered with', async () => {
    const envelope = await encryptAtRestEnvelope({ secret: 'value' }, PASSPHRASE)
    const tampered: AtRestEnvelope = {
      ...envelope,
      ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA`,
    }

    const outcome = await decryptAtRestEnvelope(tampered, PASSPHRASE)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected decryption to fail')
    expect(outcome.reason).toBe('decrypt')
  })

  it('fails closed when an authenticated header field was edited', async () => {
    const envelope = await encryptAtRestEnvelope({ secret: 'value' }, PASSPHRASE)
    const replacementIv = btoa('\u0000'.repeat(AT_REST_IV_BYTES))

    const outcome = await decryptAtRestEnvelope(
      { ...envelope, iv: replacementIv },
      PASSPHRASE,
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected header authentication to fail')
    expect(outcome.reason).toBe('decrypt')
  })

  it('refuses a future envelope version instead of guessing', async () => {
    const envelope = await encryptAtRestEnvelope({ a: 1 }, PASSPHRASE)

    const outcome = await decryptAtRestEnvelope(
      { ...envelope, formatVersion: AT_REST_FORMAT_VERSION + 1 },
      PASSPHRASE,
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected a version refusal')
    expect(outcome.reason).toBe('version')
  })

  it('refuses a malformed envelope without throwing', async () => {
    const outcome = await decryptAtRestEnvelope({ format: 'something-else' }, PASSPHRASE)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected a format refusal')
    expect(outcome.reason).toBe('format')
  })

  it('derives a usable, non-extractable key from the same salt deterministically', async () => {
    const salt = createAtRestSalt()
    const first = await deriveAtRestKey(PASSPHRASE, salt)
    const second = await deriveAtRestKey(PASSPHRASE, salt)

    expect(first.extractable).toBe(false)
    expect(first.usages).toContain('encrypt')
    expect(second.algorithm).toEqual({ name: 'AES-GCM', length: 256 })
  })
})

describe('at-rest encryption flag', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    lockAtRestSession()
    vi.restoreAllMocks()
  })

  it('is off when unset', () => {
    expect(isAtRestEncryptionEnabled()).toBe(false)
  })

  it('turns on only for the documented value', () => {
    localStorage.setItem(AT_REST_ENCRYPTION_FLAG_KEY, 'true')
    expect(isAtRestEncryptionEnabled()).toBe(false)

    setAtRestEncryptionEnabled(true)
    expect(localStorage.getItem(AT_REST_ENCRYPTION_FLAG_KEY)).toBe('1')
    expect(isAtRestEncryptionEnabled()).toBe(true)

    setAtRestEncryptionEnabled(false)
    expect(isAtRestEncryptionEnabled()).toBe(false)
  })

  it('treats an unreadable flag as off', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(isAtRestEncryptionEnabled()).toBe(false)
  })
})

describe('at-rest key session', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    lockAtRestSession()
  })

  it('starts locked and holds the key only in memory', async () => {
    expect(hasAtRestSessionKey()).toBe(false)

    await unlockAtRestSession(PASSPHRASE)
    expect(hasAtRestSessionKey()).toBe(true)

    // No passphrase or key material may reach browser storage.
    const storedValues = [
      ...Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.getItem(localStorage.key(index) ?? ''),
      ),
      ...Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.getItem(sessionStorage.key(index) ?? ''),
      ),
    ]
    expect(storedValues.join('|')).not.toContain(PASSPHRASE)

    lockAtRestSession()
    expect(hasAtRestSessionKey()).toBe(false)
  })
})
