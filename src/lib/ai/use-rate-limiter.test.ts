import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRateLimiter } from './use-rate-limiter'

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests when under the limit', () => {
    const { result } = renderHook(() =>
      useRateLimiter({ windowMs: 1000, maxRequests: 3 })
    )

    const decision = result.current.canRequest()
    expect(decision.allowed).toBe(true)
    expect(decision.count).toBe(1)
    expect(decision.limit).toBe(3)
    expect(decision.retryAfterMs).toBeUndefined()
  })

  it('denies requests when at the limit', () => {
    const { result } = renderHook(() =>
      useRateLimiter({ windowMs: 1000, maxRequests: 2 })
    )

    result.current.canRequest()
    result.current.canRequest()

    const decision = result.current.canRequest()
    expect(decision.allowed).toBe(false)
    expect(decision.count).toBe(2)
    expect(decision.limit).toBe(2)
  })

  it('calculates retryAfterMs correctly', () => {
    const { result } = renderHook(() =>
      useRateLimiter({ windowMs: 1000, maxRequests: 1 })
    )

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    result.current.canRequest()

    vi.setSystemTime(new Date('2026-01-01T00:00:00.200Z'))
    const decision = result.current.canRequest()

    expect(decision.allowed).toBe(false)
    expect(decision.retryAfterMs).toBe(800)
  })

  it('slides the window so old requests expire', () => {
    const { result } = renderHook(() =>
      useRateLimiter({ windowMs: 1000, maxRequests: 1 })
    )

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    result.current.canRequest()

    vi.setSystemTime(new Date('2026-01-01T00:00:01.001Z'))

    const decision = result.current.canRequest()
    expect(decision.allowed).toBe(true)
    expect(decision.count).toBe(1)
  })

  it('uses default 10 requests per 60s window', () => {
    const { result } = renderHook(() => useRateLimiter())

    for (let i = 0; i < 10; i++) {
      const d = result.current.canRequest()
      expect(d.allowed).toBe(true)
      expect(d.limit).toBe(10)
    }

    const denied = result.current.canRequest()
    expect(denied.allowed).toBe(false)
    expect(denied.count).toBe(10)
  })
})
