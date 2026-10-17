import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  MAX_BUFFERED_ENTRIES,
  addLogSink,
  createLogger,
  createRingBufferSink,
  logger,
  readLogEntries,
  type LogEntry,
} from './logger'

let stops: (() => void)[] = []

/**
 * Captures entries through the public sink seam — the same path a future
 * diagnostics export would use — rather than through a test-only accessor.
 */
const capture = (): LogEntry[] => {
  const entries: LogEntry[] = []
  stops.push(addLogSink({ write: (entry) => entries.push(entry) }))
  return entries
}

// The default logger also writes to the console sink; silence it so a suite run
// is readable. Individual tests re-spy where the console is the assertion.
beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  vi.unstubAllEnvs()
})

describe('logger levels', () => {
  it('records every level as a structured entry', () => {
    const entries = capture()

    logger.debug('debug message')
    logger.info('info message')
    logger.warn('warn message')
    logger.error('error message')

    expect(entries.map((entry) => entry.level)).toEqual(['debug', 'info', 'warn', 'error'])
    expect(entries.map((entry) => entry.message)).toEqual([
      'debug message',
      'info message',
      'warn message',
      'error message',
    ])
    expect(entries.every((entry) => entry.area === 'app')).toBe(true)
  })

  it('stamps each entry with an ISO-8601 timestamp', () => {
    const entries = capture()

    logger.info('stamped')

    const timestamp = entries[0]?.timestamp ?? ''
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })

  it('keeps data a plain object instead of interpolating it into the message', () => {
    const entries = capture()

    logger.info('import finished', { entities: 3, claims: 7 })

    expect(entries[0]?.message).toBe('import finished')
    expect(entries[0]?.data).toEqual({ entities: 3, claims: 7 })
  })

  it('drops entries below the configured minimum level', () => {
    const entries = capture()
    const quiet = createLogger({ minLevel: 'warn' })

    quiet.debug('dropped debug')
    quiet.info('dropped info')
    quiet.warn('kept warn')
    quiet.error('kept error')

    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error'])
  })

  it('starts at debug outside a production build and at info inside one', () => {
    const entries = capture()

    createLogger().debug('development debug')
    vi.stubEnv('NODE_ENV', 'production')
    createLogger().debug('production debug')

    expect(entries.map((entry) => entry.message)).toEqual(['development debug'])
  })
})

describe('logger child tags', () => {
  it('tags every entry with the child area', () => {
    const entries = capture()

    logger.child({ area: 'store' }).info('hydrated')

    expect(entries[0]?.area).toBe('store')
  })

  it('inherits the parent area for a child that names none, and overrides it when it does', () => {
    const entries = capture()
    const storeLogger = logger.child({ area: 'store' })

    storeLogger.child().warn('inherited')
    storeLogger.child({ area: 'sync' }).warn('overridden')

    expect(entries.map((entry) => entry.area)).toEqual(['store', 'sync'])
  })

  it('passes the parent minimum level down to children', () => {
    const entries = capture()

    createLogger({ minLevel: 'error' }).child({ area: 'sync' }).warn('dropped')

    expect(entries).toEqual([])
  })

  it('does not mutate the logger it was derived from', () => {
    const entries = capture()

    logger.child({ area: 'sync' }).info('child entry')
    logger.info('parent entry')

    expect(entries.map((entry) => entry.area)).toEqual(['sync', 'app'])
  })
})

describe('logger ring buffer', () => {
  it('evicts the oldest entry once the bound is reached', () => {
    const ring = createRingBufferSink(3)

    for (const index of [1, 2, 3, 4, 5]) {
      ring.write({
        timestamp: new Date(2026, 0, index).toISOString(),
        level: 'info',
        area: 'test',
        message: `entry ${index}`,
      })
    }

    expect(ring.read().map((entry) => entry.message)).toEqual(['entry 3', 'entry 4', 'entry 5'])
  })

  it('reads a copy, so a consumer cannot reorder the buffer', () => {
    const ring = createRingBufferSink(2)
    ring.write({ timestamp: 'now', level: 'info', area: 'test', message: 'only' })

    const readCopy = [...ring.read()]
    readCopy.length = 0

    expect(ring.read().map((entry) => entry.message)).toEqual(['only'])
  })

  it('bounds the buffer the logger actually writes to', () => {
    for (let index = 0; index <= MAX_BUFFERED_ENTRIES; index += 1) {
      logger.info(`buffer filler ${index}`)
    }

    const entries = readLogEntries()
    expect(entries).toHaveLength(MAX_BUFFERED_ENTRIES)
    expect(entries[entries.length - 1]?.message).toBe(`buffer filler ${MAX_BUFFERED_ENTRIES}`)
    expect(entries[0]?.message).not.toBe('buffer filler 0')
  })
})

describe('logger serialization', () => {
  it('marks a circular reference instead of throwing', () => {
    const entries = capture()
    const circular: Record<string, unknown> = { name: 'loop' }
    circular.self = circular

    expect(() => logger.error('circular payload', { circular })).not.toThrow()

    expect(entries[0]?.data?.circular).toEqual({ name: 'loop', self: '[Circular]' })
  })

  it('serializes an object referenced twice as data, not as a cycle', () => {
    const entries = capture()
    const shared = { level: 'deep' }

    logger.info('shared reference', { first: shared, second: shared })

    expect(entries[0]?.data).toEqual({ first: { level: 'deep' }, second: { level: 'deep' } })
  })

  it('serializes an Error with its name, message and stack', () => {
    const entries = capture()

    logger.error('provider failed', { error: new Error('boom') })

    expect(entries[0]?.data?.error).toEqual({
      name: 'Error',
      message: 'boom',
      stack: expect.any(String),
    })
  })

  it('follows an Error cause', () => {
    const entries = capture()

    logger.error('wrapped', { error: new Error('outer', { cause: new Error('inner') }) })

    expect(entries[0]?.data?.error).toMatchObject({ cause: { message: 'inner' } })
  })

  it('caps recursion depth instead of exhausting the stack', () => {
    const entries = capture()
    let deep: Record<string, unknown> = { leaf: true }
    for (let level = 0; level < MAX_BUFFERED_ENTRIES; level += 1) deep = { nested: deep }

    expect(() => logger.info('deep payload', { deep })).not.toThrow()

    expect(JSON.stringify(entries[0]?.data)).toContain('[MaxDepth]')
  })

  it('redacts credentials and entity content at any depth', () => {
    const entries = capture()

    logger.warn('settings saved', {
      apiKey: 'sk-live-1234',
      'api-key': 'sk-live-5678',
      token: 'bearer-abc',
      nested: { secret: 'hunter2', content: 'the full entity body' },
      entityId: 'entity-1',
    })

    const data = entries[0]?.data
    expect(data).toEqual({
      apiKey: '[REDACTED]',
      'api-key': '[REDACTED]',
      token: '[REDACTED]',
      nested: { secret: '[REDACTED]', content: '[REDACTED]' },
      entityId: 'entity-1',
    })
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain('sk-live')
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('the full entity body')
  })

  it('names values that have no JSON form', () => {
    const entries = capture()

    logger.info('odd payload', {
      notANumber: Number.NaN,
      infinite: Number.POSITIVE_INFINITY,
      big: BigInt(7),
      fn: function namedFn() {
        return undefined
      },
      when: new Date('2026-10-17T12:00:00.000Z'),
      entries: new Map([['a', 1]]),
    })

    expect(entries[0]?.data).toEqual({
      notANumber: 'NaN',
      infinite: 'Infinity',
      big: '7',
      fn: '[Function namedFn]',
      when: '2026-10-17T12:00:00.000Z',
      entries: 'Map(1)',
    })
  })

  it('reports a payload it cannot enumerate instead of throwing', () => {
    const entries = capture()
    const hostile = {
      get boom(): never {
        throw new Error('getter exploded')
      },
    }

    expect(() => logger.info('hostile payload', { hostile })).not.toThrow()

    expect(entries[0]?.data).toEqual({
      serializationFailed: true,
      reason: 'Error: getter exploded',
    })
  })
})

describe('logger sinks', () => {
  it('stops delivering to a sink once it is unregistered', () => {
    const entries = capture()

    logger.info('before')
    for (const stop of stops) stop()
    stops = []
    logger.info('after')

    expect(entries.map((entry) => entry.message)).toEqual(['before'])
  })

  it('keeps working when a sink throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const entries = capture()
    addLogSink({
      write: () => {
        throw new Error('sink exploded')
      },
    })

    expect(() => logger.info('still delivered')).not.toThrow()

    expect(entries.map((entry) => entry.message)).toEqual(['still delivered'])
    expect(errorSpy).toHaveBeenCalled()
  })
})
