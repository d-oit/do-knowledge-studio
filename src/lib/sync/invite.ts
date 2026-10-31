/**
 * Room invitation helpers (Issue #1035).
 *
 * An invitation carries only a high-entropy room id and optional timestamps.
 * It NEVER carries a password or derived key, so a QR code or copied invite
 * cannot leak the room secret. The protocol has no server-side revocation:
 * leaving the room and generating a new id is the supported way to revoke
 * access to future sessions.
 */
import { z } from 'zod'

/** Prefix for versioned invitation tokens. */
export const INVITE_PREFIX = 'dks1.'
/** Default invitation lifetime: 24 hours. */
export const DEFAULT_INVITE_TTL_MS = 24 * 60 * 60 * 1000
/** Minimum room id entropy in bytes (128 bits). */
const ROOM_ID_BYTES = 16

const InvitePayloadSchema = z.object({
  roomId: z.string().min(1).max(256),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
})

export type InvitePayload = z.infer<typeof InvitePayloadSchema>

/** Result of parsing an invitation or a legacy raw room id. */
export type ParsedInvite =
  | { ok: true; roomId: string; expiresAt: number | null; legacy: boolean }
  | { ok: false; reason: 'malformed' | 'expired' }

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Generate a 128-bit random room id (22 URL-safe characters). */
export const generateRoomId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_BYTES))
  return toBase64Url(bytes)
}

/** Build a shareable invite token that expires after `ttlMs`. */
export const createInvite = (
  roomId: string,
  ttlMs: number = DEFAULT_INVITE_TTL_MS,
  now: number = Date.now(),
): string => {
  const payload: InvitePayload = {
    roomId,
    createdAt: now,
    expiresAt: now + Math.max(1, ttlMs),
  }
  return `${INVITE_PREFIX}${toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))}`
}

/** Parse an invitation token; raw legacy room ids remain accepted. */
export const parseInvite = (value: string, now: number = Date.now()): ParsedInvite => {
  const trimmed = value.trim()
  if (!trimmed.startsWith(INVITE_PREFIX)) {
    return trimmed === ''
      ? { ok: false, reason: 'malformed' }
      : { ok: true, roomId: trimmed, expiresAt: null, legacy: true }
  }
  try {
    const json = new TextDecoder().decode(fromBase64Url(trimmed.slice(INVITE_PREFIX.length)))
    const parsed = InvitePayloadSchema.safeParse(JSON.parse(json))
    if (!parsed.success) return { ok: false, reason: 'malformed' }
    if (parsed.data.expiresAt <= now) return { ok: false, reason: 'expired' }
    return {
      ok: true,
      roomId: parsed.data.roomId,
      expiresAt: parsed.data.expiresAt,
      legacy: false,
    }
  } catch {
    return { ok: false, reason: 'malformed' }
  }
}

/** Whether a value is a versioned invitation token. */
export const isInviteToken = (value: string): boolean => value.trim().startsWith(INVITE_PREFIX)
