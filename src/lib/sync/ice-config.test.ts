import { describe, expect, it } from 'vitest'
import {
  MAX_ICE_SERVERS,
  MAX_ICE_URLS_PER_SERVER,
  parseIceServersEnv,
  redactIceServers,
  sameIceServers,
  toRtcIceServers,
  validateIceServers,
} from './ice-config'

/** Codes of a rejected result, for assertions that do not depend on messages. */
const rejectionCodes = (result: ReturnType<typeof validateIceServers>): string[] =>
  result.ok ? [] : result.issues.map((issue) => issue.code)

describe('validateIceServers', () => {
  it('accepts a STUN server without credentials', () => {
    const result = validateIceServers([{ urls: ['stun:stun.example.com:3478'] }])
    expect(result).toEqual({ ok: true, servers: [{ urls: ['stun:stun.example.com:3478'] }] })
  })

  it('accepts a TLS TURN server with credentials', () => {
    const result = validateIceServers([
      { urls: ['turns:relay.example.com:5349?transport=tcp'], username: 'user', credential: 'secret' },
    ])
    expect(result.ok).toBe(true)
    expect(result.ok && result.servers[0]?.username).toBe('user')
  })

  it('accepts a single URL written as a string', () => {
    const result = validateIceServers([{ urls: 'stuns:stun.example.com:5349' }])
    expect(result).toEqual({ ok: true, servers: [{ urls: ['stuns:stun.example.com:5349'] }] })
  })

  it('rejects malformed and unknown-scheme URLs', () => {
    expect(rejectionCodes(validateIceServers([{ urls: ['relay.example.com:3478'] }]))).toEqual([
      'malformed-url',
    ])
    expect(rejectionCodes(validateIceServers([{ urls: ['http://relay.example.com'] }]))).toEqual([
      'unsupported-scheme',
    ])
    expect(rejectionCodes(validateIceServers([{ urls: ['stun:'] }]))).toEqual(['malformed-url'])
  })

  it('rejects credentials embedded in the URL', () => {
    const result = validateIceServers([
      { urls: ['turns:user:secret@relay.example.com:5349'], username: 'user', credential: 'secret' },
    ])
    expect(rejectionCodes(result)).toEqual(['credentials-in-url'])
  })

  it('rejects plaintext TURN to a public host, and allows loopback or an explicit override', () => {
    const publicTurn = [{ urls: ['turn:relay.example.com:3478'], username: 'user', credential: 'secret' }]
    expect(rejectionCodes(validateIceServers(publicTurn))).toEqual(['insecure-turn'])
    expect(validateIceServers(publicTurn, { allowInsecureTurn: true }).ok).toBe(true)
    expect(
      validateIceServers([{ urls: ['turn:localhost:3478'], username: 'user', credential: 'secret' }]).ok,
    ).toBe(true)
  })

  it('requires both credential fields for TURN', () => {
    expect(rejectionCodes(validateIceServers([{ urls: ['turns:relay.example.com:5349'], username: 'user' }]))).toEqual([
      'missing-credentials',
    ])
    expect(rejectionCodes(validateIceServers([{ urls: ['turns:relay.example.com:5349'] }]))).toEqual([
      'missing-credentials',
    ])
  })

  it('rejects entries that are not servers and lists that are too large', () => {
    expect(rejectionCodes(validateIceServers(['stun:stun.example.com']))).toEqual(['shape'])
    expect(rejectionCodes(validateIceServers([{ urls: [] }]))).toEqual(['shape'])
    const tooMany = Array.from({ length: MAX_ICE_SERVERS + 1 }, (_, index) => ({
      urls: [`stun:stun${String(index)}.example.com:3478`],
    }))
    expect(rejectionCodes(validateIceServers(tooMany))).toEqual(['too-many-servers'])
    const tooManyUrls = [
      {
        urls: Array.from(
          { length: MAX_ICE_URLS_PER_SERVER + 1 },
          (_, index) => `stun:stun${String(index)}.example.com:3478`,
        ),
      },
    ]
    expect(rejectionCodes(validateIceServers(tooManyUrls))).toEqual(['too-many-urls'])
  })

  it('deduplicates URLs and identical servers', () => {
    const result = validateIceServers([
      { urls: ['stun:stun.example.com:3478', 'stun:stun.example.com:3478'] },
      { urls: ['stun:stun.example.com:3478'] },
    ])
    expect(result).toEqual({ ok: true, servers: [{ urls: ['stun:stun.example.com:3478'] }] })
  })

  it('never echoes a credential in a rejection message', () => {
    const result = validateIceServers([
      { urls: ['turn:relay.example.com:3478'], username: 'hidden-user', credential: 'hidden-secret' },
    ])
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('hidden-secret')
    expect(serialized).not.toContain('hidden-user')
  })
})

describe('ICE display helpers', () => {
  it('redacts credentials and usernames but keeps URLs', () => {
    const redacted = redactIceServers([
      { urls: ['turns:relay.example.com:5349'], username: 'hidden-user', credential: 'hidden-secret' },
    ])
    expect(redacted).toEqual([{ urls: ['turns:relay.example.com:5349'], authenticated: true }])
    expect(JSON.stringify(redacted)).not.toContain('hidden-secret')
    expect(JSON.stringify(redacted)).not.toContain('hidden-user')
  })

  it('converts to RTCIceServer objects with credentials only when present', () => {
    expect(toRtcIceServers([{ urls: ['stun:stun.example.com:3478'] }])).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
    ])
    expect(
      toRtcIceServers([{ urls: ['turns:relay.example.com:5349'], username: 'u', credential: 'c' }]),
    ).toEqual([{ urls: ['turns:relay.example.com:5349'], username: 'u', credential: 'c' }])
  })

  it('compares configuration by value', () => {
    expect(sameIceServers([{ urls: ['stun:a.example.com:3478'] }], [{ urls: ['stun:a.example.com:3478'] }])).toBe(
      true,
    )
    expect(sameIceServers([{ urls: ['stun:a.example.com:3478'] }], [{ urls: ['stun:b.example.com:3478'] }])).toBe(
      false,
    )
    expect(sameIceServers(undefined, [])).toBe(true)
  })
})

describe('parseIceServersEnv', () => {
  it('parses a JSON array', () => {
    expect(parseIceServersEnv('[{"urls":["stun:stun.example.com:3478"]}]')).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
    ])
  })

  it('ignores empty, malformed and invalid configuration', () => {
    expect(parseIceServersEnv(undefined)).toEqual([])
    expect(parseIceServersEnv('  ')).toEqual([])
    expect(parseIceServersEnv('not json')).toEqual([])
    expect(parseIceServersEnv('[{"urls":["turn:relay.example.com:3478"]}]')).toEqual([])
  })
})
