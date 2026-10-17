import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { addLogSink, type LogEntry } from '@/lib/logging/logger'
import { GlobalRuntimeHandlers } from './global-runtime-handlers'

/**
 * The provider only matters for failures React never sees, so these tests
 * dispatch the real window events rather than calling any internal function:
 * registration, dedup and cleanup are exactly what is under test.
 */

let stops: (() => void)[] = []

const capture = (): LogEntry[] => {
  const entries: LogEntry[] = []
  stops.push(addLogSink({ write: (entry) => entries.push(entry) }))
  return entries
}

/** Dispatches `unhandledrejection` with the given reason, as a browser would. */
const dispatchRejection = (reason: unknown): void => {
  const event = new Event('unhandledrejection')
  Object.assign(event, { reason })
  window.dispatchEvent(event)
}

/** Dispatches `error` with the given thrown value and message. */
const dispatchError = (error: unknown, message = ''): void => {
  const event = new Event('error')
  Object.assign(event, { error, message })
  window.dispatchEvent(event)
}

beforeEach(() => {
  // The logger's console sink is real; a suite run should stay readable.
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
})

describe('GlobalRuntimeHandlers', () => {
  it('reports an unhandled rejection into the global area', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchRejection(new Error('bridge promise rejected'))

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      level: 'error',
      area: 'global',
      message: 'bridge promise rejected',
    })
    expect(entries[0]?.data).toMatchObject({ source: 'unhandledrejection', name: 'Error' })
  })

  it('reports an uncaught runtime error into the global area', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchError(new Error('timer callback threw'))

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      level: 'error',
      area: 'global',
      message: 'timer callback threw',
    })
    expect(entries[0]?.data).toMatchObject({ source: 'error' })
  })

  it('records a rejection that carried no Error value', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchRejection({ status: 503 })

    expect(entries[0]?.message).toBe('Failure without an Error value')
    expect(entries[0]?.data).toMatchObject({ source: 'unhandledrejection' })
  })

  it('reports a repeated identical failure only once', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchRejection(new Error('storm'))
    dispatchRejection(new Error('storm'))
    dispatchError(new Error('storm'))

    expect(entries).toHaveLength(1)
  })

  it('still reports a different failure inside the dedup window', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchRejection(new Error('first'))
    dispatchError(new Error('second'))

    expect(entries.map((entry) => entry.message)).toEqual(['first', 'second'])
  })

  it('ignores an event that carries neither an error nor a message', () => {
    const entries = capture()
    render(<GlobalRuntimeHandlers />)

    dispatchError(null, '')

    expect(entries).toEqual([])
  })

  it('stops reporting once it is unmounted', () => {
    const entries = capture()
    const { unmount } = render(<GlobalRuntimeHandlers />)

    dispatchRejection(new Error('while mounted'))
    unmount()
    dispatchRejection(new Error('while unmounted'))

    expect(entries.map((entry) => entry.message)).toEqual(['while mounted'])
  })
})
