/**
 * Sync room encryption contract (Issue #1035).
 *
 * `y-webrtc` derives an AES-256-GCM key from the room password and room name:
 * PBKDF2-HMAC-SHA256, 100000 iterations, room name as the salt. That key
 * encrypts signaling payloads (announce/SDP/ICE) and BroadcastChannel messages.
 * WebRTC data-channel payloads are protected by DTLS; they are NOT additionally
 * wrapped in this AES key.
 *
 * This module mirrors the derivation so the UI can display a stable room-key
 * fingerprint that two people can compare out-of-band. The fingerprint proves
 * "we derived the same key", not "you are the intended person": anyone who
 * knows the room id and password is authorized by the protocol.
 *
 * Password and derived key material never enter logs, URLs, or persisted state.
 */

/** Description of the installed y-webrtc crypto parameters. */
export const SYNC_CRYPTO_CONTRACT = {
  kdf: 'PBKDF2-HMAC-SHA256',
  iterations: 100_000,
  salt: 'room-name-utf8',
  cipher: 'AES-256-GCM',
  ivBytes: 12,
  tagBits: 128,
  keyBytes: 32,
  signalingEncrypted: true,
  broadcastChannelEncrypted: true,
  dataChannelAdditionalEncryption: false,
  dataChannelTransport: 'DTLS',
} as const

/** Version of the app-level encrypted envelope used by the contract tests. */
export const SYNC_ENVELOPE_VERSION = 1

/** Encrypted app-level envelope. */
export interface SyncEncryptedEnvelope {
  v: number
  alg: 'AES-GCM'
  iv: string
  data: string
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

const roomKeyMaterial = async (password: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    asArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

/**
 * Derive the room key exactly as y-webrtc does.
 *
 * The key is extractable solely because the fingerprint needs the raw bytes;
 * callers in this module never return it.
 */
const deriveRoomKey = async (roomId: string, password: string): Promise<CryptoKey> => {
  const material = await roomKeyMaterial(password)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(new TextEncoder().encode(roomId)),
      iterations: SYNC_CRYPTO_CONTRACT.iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Stable short fingerprint of the derived room key.
 *
 * Format: four lowercase hex groups (`a1b2-c3d4-e5f6-7890`). Compare it over a
 * separate channel to detect a password typo; it does not authenticate a peer.
 */
export const deriveRoomKeyFingerprint = async (
  roomId: string,
  password: string,
): Promise<string> => {
  const key = await deriveRoomKey(roomId, password)
  const raw = await crypto.subtle.exportKey('raw', key)
  const digest = await crypto.subtle.digest('SHA-256', raw)
  const hex = Array.from(new Uint8Array(digest).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return (hex.match(/.{4}/g) ?? []).join('-')
}

const additionalData = (roomId: string): Uint8Array =>
  new TextEncoder().encode(`dks-sync-v${SYNC_ENVELOPE_VERSION}:${roomId}`)

/** Encrypt a payload with the room key (used by contract tests/tools). */
export const encryptRoomPayload = async (
  roomId: string,
  password: string,
  plaintext: string,
): Promise<SyncEncryptedEnvelope> => {
  const key = await deriveRoomKey(roomId, password)
  const iv = crypto.getRandomValues(new Uint8Array(SYNC_CRYPTO_CONTRACT.ivBytes))
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(additionalData(roomId)),
      tagLength: SYNC_CRYPTO_CONTRACT.tagBits,
    },
    key,
    asArrayBuffer(new TextEncoder().encode(plaintext)),
  )
  return {
    v: SYNC_ENVELOPE_VERSION,
    alg: 'AES-GCM',
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  }
}

/**
 * Decrypt an app-level payload. Wrong password, corrupted ciphertext, a
 * different room id, and an unsupported envelope version all reject.
 */
export const decryptRoomPayload = async (
  roomId: string,
  password: string,
  envelope: unknown,
): Promise<string> => {
  if (typeof envelope !== 'object' || envelope === null) {
    throw new Error('Sync envelope is malformed')
  }
  const candidate = envelope as Partial<SyncEncryptedEnvelope>
  if (candidate.v !== SYNC_ENVELOPE_VERSION) {
    throw new Error(`Unsupported sync envelope version: ${String(candidate.v)}`)
  }
  if (candidate.alg !== 'AES-GCM' || typeof candidate.iv !== 'string' || typeof candidate.data !== 'string') {
    throw new Error('Sync envelope is malformed')
  }
  const key = await deriveRoomKey(roomId, password)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(fromBase64(candidate.iv)),
      additionalData: asArrayBuffer(additionalData(roomId)),
      tagLength: SYNC_CRYPTO_CONTRACT.tagBits,
    },
    key,
    asArrayBuffer(fromBase64(candidate.data)),
  )
  return new TextDecoder().decode(decrypted)
}
