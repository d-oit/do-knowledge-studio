import { describe, expect, it } from 'vitest'
import {
  createInvite,
  DEFAULT_INVITE_TTL_MS,
  generateRoomId,
  parseInvite,
} from './invite'

describe('sync invitations', () => {
  it('generates high-entropy URL-safe room ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRoomId()))
    expect(ids.size).toBe(100)
    for (const id of ids) {
      expect(id).toHaveLength(22)
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    }
  })

  it('round-trips a token without embedding a password', () => {
    const token = createInvite('room-id', DEFAULT_INVITE_TTL_MS, 1_000)
    expect(token).not.toContain('password')
    const parsed = parseInvite(token, 1_500)
    expect(parsed).toMatchObject({ ok: true, roomId: 'room-id', legacy: false })
    if (parsed.ok) expect(parsed.expiresAt).toBe(1_000 + DEFAULT_INVITE_TTL_MS)
  })

  it('rejects expired and malformed tokens', () => {
    const token = createInvite('room-id', 1_000, 1_000)
    expect(parseInvite(token, 2_001)).toEqual({ ok: false, reason: 'expired' })
    expect(parseInvite('dks1.not-valid-base64', 1_000)).toEqual({ ok: false, reason: 'malformed' })
    expect(parseInvite('   ', 1_000)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('accepts a legacy raw room id for compatibility', () => {
    expect(parseInvite('legacy-room', 1_000)).toEqual({
      ok: true,
      roomId: 'legacy-room',
      expiresAt: null,
      legacy: true,
    })
  })
})
