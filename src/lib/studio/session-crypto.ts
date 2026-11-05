/**
 * Session-scoped AES-GCM for local credentials.
 *
 * Shared by the AI settings store and the sync ICE settings store: a raw
 * AES-256 key lives in `sessionStorage` (one per caller, under its own storage
 * key) and every value is encrypted with a fresh 12-byte IV. Closing the tab
 * destroys the key, so an offline copy of IndexedDB holds ciphertext only.
 *
 * The key is seeded into `sessionStorage` as base64 because a `CryptoKey` is not
 * serializable across a reload; it is imported back as non-extractable. Tabs
 * opened with an opener (see `ai-settings.ts`) inherit the key — this is
 * session scoping, not isolation from same-origin scripts (XSS).
 */

/** AES-GCM IV length in bytes. */
const IV_BYTES = 12
/** AES-GCM key length in bits. */
const KEY_BITS = 256

/** RFC 4648 base64 of arbitrary bytes, without `Buffer`. */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Decodes base64 into bytes; malformed input throws so callers log and skip. */
const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/** Loads the session key, creating and seeding it on first use. */
const getOrCreateSessionKey = async (keyStorageKey: string): Promise<CryptoKey> => {
  const stored = sessionStorage.getItem(keyStorageKey)
  if (stored !== null) {
    // `Uint8Array<ArrayBufferLike>` is not assignable to `BufferSource` under
    // the DOM lib; the backing buffer here is always a plain ArrayBuffer.
    const raw = fromBase64(stored) as unknown as ArrayBuffer
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: KEY_BITS }, true, [
    'encrypt',
    'decrypt',
  ])
  const exported = await crypto.subtle.exportKey('raw', key)
  sessionStorage.setItem(keyStorageKey, toBase64(new Uint8Array(exported)))
  return crypto.subtle.importKey('raw', exported, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Encrypts text, returning base64 of `iv || ciphertext`. */
export const encryptSessionValue = async (
  value: string,
  keyStorageKey: string,
): Promise<string> => {
  const key = await getOrCreateSessionKey(keyStorageKey)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return toBase64(combined)
}

/**
 * Decrypts a value produced by {@link encryptSessionValue}.
 * @returns The plaintext, or `null` when the key is gone (new session) or the
 *   ciphertext is malformed. Never throws for bad input.
 */
export const decryptSessionValue = async (
  encrypted: string,
  keyStorageKey: string,
): Promise<string | null> => {
  if (encrypted === '') return null
  try {
    const key = await getOrCreateSessionKey(keyStorageKey)
    const combined = fromBase64(encrypted)
    const iv = combined.slice(0, IV_BYTES)
    const data = combined.slice(IV_BYTES)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data as unknown as ArrayBuffer,
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    // A wrong session key or tampered ciphertext is expected after a reload in
    // a fresh session; callers treat `null` as "no stored credential".
    return null
  }
}
