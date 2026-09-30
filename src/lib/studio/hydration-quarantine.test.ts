import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  QUARANTINE_KEY,
  clearQuarantine,
  describeQuarantine,
  quarantinePayload,
  readQuarantine,
} from './hydration-quarantine'

/**
 * Runs `body` with `localStorage` replaced by a stub whose `method` throws.
 * The stub is confined to `body` so it cannot leak into the next test.
 */
const withThrowingStorage = <T,>(
  method: 'getItem' | 'setItem' | 'removeItem',
  body: () => T,
): T => {
  const real = window.localStorage
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    [method]: () => {
      throw new Error('SecurityError')
    },
  })
  try {
    return body()
  } finally {
    vi.stubGlobal('localStorage', real)
  }
}

/** A minimal stored envelope with a readable entity/claim count. */
const ENVELOPE = JSON.stringify({
  state: {
    entities: [{ id: 'a' }, { id: 'b' }],
    claims: [{ id: 'c' }],
  },
  version: 3,
})

describe('hydration quarantine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('round-trips a preserved payload with its reason', () => {
    expect(quarantinePayload('bad shape', ENVELOPE)).toBe(true)

    const record = readQuarantine()
    expect(record?.raw).toBe(ENVELOPE)
    expect(record?.reason).toBe('bad shape')
    expect(record?.rejectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('keeps the payload out of the key the store writes', () => {
    quarantinePayload('bad shape', ENVELOPE)
    // The live store key is untouched, so nothing here can be clobbered by a
    // subsequent setState writing seed data over it.
    expect(localStorage.getItem(QUARANTINE_KEY)).not.toBeNull()
    expect(readQuarantine()?.raw).toBe(ENVELOPE)
  })

  it('treats a missing payload as nothing to preserve', () => {
    expect(quarantinePayload('no payload', null)).toBe(true)
    expect(readQuarantine()).toBeNull()
  })

  it('describes what was preserved for the UI', () => {
    quarantinePayload('bad shape', ENVELOPE)
    const record = readQuarantine()
    expect(record).not.toBeNull()
    if (!record) throw new Error('expected a record')
    expect(describeQuarantine(record)).toBe('2 entities and 1 claims')
  })

  it('falls back to generic wording for an unreadable payload', () => {
    const record = { rejectedAt: 'x', reason: 'y', raw: 'not json' }
    expect(describeQuarantine(record)).toBe('your previous library')
  })

  it('reports failure rather than pretending an oversized payload is safe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const huge = 'x'.repeat(5 * 1024 * 1024)

    expect(quarantinePayload('too big', huge)).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('quarantine limit'))
    expect(readQuarantine()).toBeNull()
  })

  it('reports failure when storage rejects the write', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // jsdom resolves `localStorage` through the global, so stub the global —
    // spying on Storage.prototype does not intercept the instance.
    withThrowingStorage('setItem', () => {
      expect(quarantinePayload('bad shape', ENVELOPE)).toBe(false)
    })
    expect(error).toHaveBeenCalledWith(
      'Failed to quarantine rejected payload:',
      'SecurityError',
    )
  })

  it('drops an entry that cannot be parsed instead of wedging every read', () => {
    localStorage.setItem(QUARANTINE_KEY, 'not json at all')
    expect(readQuarantine()).toBeNull()
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull()
  })

  it('drops an entry missing the preserved bytes', () => {
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify({ reason: 'x' }))
    expect(readQuarantine()).toBeNull()
  })

  it('clears the entry', () => {
    quarantinePayload('bad shape', ENVELOPE)
    clearQuarantine()
    expect(readQuarantine()).toBeNull()
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull()
  })

  it('returns null rather than throwing when storage is unreadable', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    withThrowingStorage('getItem', () => {
      expect(readQuarantine()).toBeNull()
    })
    expect(error).toHaveBeenCalledWith(
      'Failed to read quarantined payload:',
      'SecurityError',
    )
  })
})
