/**
 * WebCrypto primitives for backup archives (Issue #1040).
 *
 * Passphrase encryption uses PBKDF2-HMAC-SHA256 and AES-256-GCM, with the
 * archive format and every KDF parameter bound as additional authenticated
 * data. No key or passphrase is ever embedded in the archive.
 */
import {
  AES_IV_BYTES,
  AES_TAG_BITS,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_KDF_ITERATIONS,
  KDF_SALT_BYTES,
  type BackupEncryptionHeader,
} from './archive-format'

/** Copy bytes into a plain ArrayBuffer accepted by WebCrypto. */
export const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** SHA-256 as lowercase hex. */
export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', asArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 of UTF-8 text. */
export const sha256Text = (text: string): Promise<string> =>
  sha256Hex(new TextEncoder().encode(text))

/** AAD binds ciphertext to the format and every KDF parameter. */
const additionalData = (header: Omit<BackupEncryptionHeader, 'ciphertextSha256'>): Uint8Array =>
  new TextEncoder().encode(
    JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      algorithm: header.algorithm,
      kdf: header.kdf,
      iterations: header.iterations,
      salt: header.salt,
      iv: header.iv,
    }),
  )

const deriveBackupKey = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    asArrayBuffer(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asArrayBuffer(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt a plaintext archive payload. */
export const encryptArchivePayload = async (
  plaintext: string,
  passphrase: string,
): Promise<{ ciphertext: string; encryption: BackupEncryptionHeader }> => {
  const salt = crypto.getRandomValues(new Uint8Array(KDF_SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES))
  const key = await deriveBackupKey(passphrase, salt, BACKUP_KDF_ITERATIONS)
  const header = {
    algorithm: 'AES-256-GCM' as const,
    kdf: 'PBKDF2-HMAC-SHA256' as const,
    iterations: BACKUP_KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
  }
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(additionalData(header)),
      tagLength: AES_TAG_BITS,
    },
    key,
    asArrayBuffer(new TextEncoder().encode(plaintext)),
  )
  const ciphertext = new Uint8Array(encrypted)
  return {
    ciphertext: toBase64(ciphertext),
    encryption: { ...header, ciphertextSha256: await sha256Hex(ciphertext) },
  }
}

/** Decrypt an archive payload; wrong passphrase or tampering rejects. */
export const decryptArchivePayload = async (
  ciphertext: Uint8Array,
  header: BackupEncryptionHeader,
  passphrase: string,
): Promise<string> => {
  const { ciphertextSha256: _ignored, ...aadHeader } = header
  const key = await deriveBackupKey(passphrase, fromBase64(header.salt), header.iterations)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(fromBase64(header.iv)),
      additionalData: asArrayBuffer(additionalData(aadHeader)),
      tagLength: AES_TAG_BITS,
    },
    key,
    asArrayBuffer(ciphertext),
  )
  return new TextDecoder().decode(decrypted)
}
