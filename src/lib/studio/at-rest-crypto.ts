/**
 * At-rest envelope codec for the canonical corpus (ADR 048 prototype).
 *
 * This module is deliberately NOT wired into `canonical-storage.ts`. ADR 048
 * keeps the decision at Proposed: encrypting the live corpus is a persistence
 * migration that needs an unlock UI, a plaintext-surface inventory for the Yjs
 * replica and recovery snapshots, and shadow/canary evidence in a real browser.
 * What exists here is the cryptographic half, isolated so it can be reviewed and
 * tested without touching the store the app loads at boot.
 *
 * Contract:
 * - AES-256-GCM with a random 12-byte IV per envelope.
 * - PBKDF2-HMAC-SHA256 at 600,000 iterations (matches the export path, ADR 048).
 * - The header fields are bound as additional authenticated data, so a header
 *   edit invalidates the tag instead of silently changing the derivation.
 * - Decryption returns a discriminated result and never throws for bad input;
 *   callers must treat `ok: false` as "do not touch canonical state".
 */

import { z } from 'zod'

/** Envelope marker so an unencrypted record is never mistaken for ciphertext. */
export const AT_REST_FORMAT = 'dks-at-rest-envelope'
/** Version of the envelope shape and AAD composition. */
export const AT_REST_FORMAT_VERSION = 1
/** PBKDF2-HMAC-SHA256 iterations; matches `src/lib/export/encrypt.ts`. */
export const AT_REST_KDF_ITERATIONS = 600_000
/** Random salt length in bytes. */
export const AT_REST_SALT_BYTES = 16
/** Random IV length in bytes for AES-GCM. */
export const AT_REST_IV_BYTES = 12
/** AES key length in bits. */
export const AT_REST_KEY_BITS = 256
/** Authentication tag length in bits. */
export const AT_REST_TAG_BITS = 128

const KDF_NAME = 'PBKDF2-HMAC-SHA256' as const
const ALGORITHM_NAME = 'AES-256-GCM' as const

/** Encrypted form of a canonical envelope. */
export interface AtRestEnvelope {
  format: typeof AT_REST_FORMAT
  /** Parsed as a number so a future version can be refused, not crashed on. */
  formatVersion: number
  kdf: typeof KDF_NAME
  iterations: number
  algorithm: typeof ALGORITHM_NAME
  salt: string
  iv: string
  ciphertext: string
}

/** Why decryption refused to produce a value. */
export type AtRestFailureReason = 'format' | 'version' | 'decrypt'

/** Discriminated decrypt outcome; failures never mutate caller state. */
export type AtRestDecryptResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: AtRestFailureReason; message: string }

const AtRestEnvelopeSchema = z.object({
  format: z.literal(AT_REST_FORMAT),
  formatVersion: z.number().int().positive(),
  kdf: z.literal(KDF_NAME),
  iterations: z.number().int().min(AT_REST_KDF_ITERATIONS),
  algorithm: z.literal(ALGORITHM_NAME),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
})

/** Encode bytes as base64 without Buffer (browser + jsdom). */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Decode base64 into bytes; throws on malformed input so callers validate. */
const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/** A fresh random salt for a new corpus key. */
export const createAtRestSalt = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(AT_REST_SALT_BYTES))

/**
 * Derives a non-extractable AES-GCM key from a passphrase and salt.
 *
 * The key lives only in the caller's memory; this module never stores it in
 * localStorage, sessionStorage, IndexedDB, or a log.
 */
export const deriveAtRestKey = async (
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: AT_REST_KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: AT_REST_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Header fields bound into the GCM tag, in a fixed order. */
const additionalData = (
  header: Pick<AtRestEnvelope, 'format' | 'formatVersion' | 'kdf' | 'iterations' | 'algorithm' | 'salt' | 'iv'>,
): Uint8Array =>
  new TextEncoder().encode(
    JSON.stringify([
      header.format,
      header.formatVersion,
      header.kdf,
      header.iterations,
      header.algorithm,
      header.salt,
      header.iv,
    ]),
  )

/**
 * Encrypts a JSON-serializable value into an authenticated envelope.
 *
 * @throws when the value cannot be serialized or WebCrypto rejects the input;
 *   this is the write path, where a failure must surface rather than be stored.
 */
export const encryptAtRestEnvelope = async (
  value: unknown,
  passphrase: string,
): Promise<AtRestEnvelope> => {
  const salt = createAtRestSalt()
  const key = await deriveAtRestKey(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(AT_REST_IV_BYTES))
  const header: Pick<
    AtRestEnvelope,
    'format' | 'formatVersion' | 'kdf' | 'iterations' | 'algorithm' | 'salt' | 'iv'
  > = {
    format: AT_REST_FORMAT,
    formatVersion: AT_REST_FORMAT_VERSION,
    kdf: KDF_NAME,
    iterations: AT_REST_KDF_ITERATIONS,
    algorithm: ALGORITHM_NAME,
    salt: toBase64(salt),
    iv: toBase64(iv),
  }

  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as ArrayBuffer,
      additionalData: additionalData(header) as unknown as ArrayBuffer,
      tagLength: AT_REST_TAG_BITS,
    },
    key,
    plaintext,
  )

  return { ...header, ciphertext: toBase64(new Uint8Array(ciphertext)) }
}

/** Narrows an unknown record without trusting its contents. */
const parseEnvelope = (candidate: unknown): AtRestEnvelope | null => {
  const parsed = AtRestEnvelopeSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/**
 * Decrypts an envelope, refusing rather than guessing.
 *
 * Every failure mode — unknown shape, newer format, unsupported KDF parameters,
 * wrong passphrase, tampered ciphertext — returns `ok: false`. The caller must
 * block canonical writes on failure instead of falling back to plaintext.
 */
export const decryptAtRestEnvelope = async (
  candidate: unknown,
  passphrase: string,
): Promise<AtRestDecryptResult> => {
  const envelope = parseEnvelope(candidate)
  if (envelope === null) {
    return { ok: false, reason: 'format', message: 'envelope does not match the at-rest format' }
  }
  if (envelope.formatVersion !== AT_REST_FORMAT_VERSION) {
    return {
      ok: false,
      reason: 'version',
      message: `unsupported at-rest envelope version: ${envelope.formatVersion}`,
    }
  }
  if (envelope.iterations !== AT_REST_KDF_ITERATIONS) {
    return {
      ok: false,
      reason: 'format',
      message: `unsupported KDF iteration count: ${envelope.iterations}`,
    }
  }

  try {
    const salt = fromBase64(envelope.salt)
    const iv = fromBase64(envelope.iv)
    if (salt.length !== AT_REST_SALT_BYTES || iv.length !== AT_REST_IV_BYTES) {
      return { ok: false, reason: 'format', message: 'envelope has an invalid salt or IV length' }
    }
    const key = await deriveAtRestKey(passphrase, salt)
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBuffer,
        additionalData: additionalData(envelope) as unknown as ArrayBuffer,
        tagLength: AT_REST_TAG_BITS,
      },
      key,
      fromBase64(envelope.ciphertext) as unknown as ArrayBuffer,
    )
    const decoded: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    return { ok: true, value: decoded }
  } catch (error) {
    return {
      ok: false,
      reason: 'decrypt',
      message: error instanceof Error ? error.message : 'at-rest decryption failed',
    }
  }
}
