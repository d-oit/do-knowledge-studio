import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchProviderWithRetry,
  parseRetryAfter,
  computeRetryDelayMs,
  isRetryableStatus,
  PROVIDER_MAX_RETRIES,
  PROVIDER_RETRY_AFTER_MAX_MS,
} from './provider-errors'
import { ErrorCode } from '@/lib/errors'

/** Minimal Response stand-in for a provider failure. */
const makeErrorResponse = (status: number, headers?: Record<string, string>): Response => {
  const response = {
    ok: false,
    status,
    headers: new Headers(headers),
    text: () => Promise.resolve('provider failure'),
  }
  return response as unknown as Response
}

/** Minimal Response stand-in for a successful provider response. */
const makeOkResponse = (): Response => {
  const response = { ok: true, status: 200 }
  return response as unknown as Response
}

const request = (signal?: AbortSignal) =>
  fetchProviderWithRetry({ label: 'TestProvider', url: 'https://provider.test', init: {}, signal })

describe('provider-errors helpers', () => {
  it('treats 429 and 5xx as retryable, other 4xx as not', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(599)).toBe(true)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(200)).toBe(false)
  })

  it('parses Retry-After seconds and caps them', () => {
    expect(parseRetryAfter('0')).toBe(0)
    expect(parseRetryAfter('2')).toBe(2_000)
    expect(parseRetryAfter(String(PROVIDER_RETRY_AFTER_MAX_MS))).toBe(PROVIDER_RETRY_AFTER_MAX_MS)
    expect(parseRetryAfter('not-a-value')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })

  it('honours Retry-After over backoff and jitters the backoff', () => {
    expect(computeRetryDelayMs(0, 1_234)).toBe(1_234)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(computeRetryDelayMs(0)).toBeGreaterThan(0)
    expect(computeRetryDelayMs(0)).toBeLessThanOrEqual(computeRetryDelayMs(1))
  })
})

describe('fetchProviderWithRetry', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retries a 500 and then succeeds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(500))
      .mockResolvedValueOnce(makeOkResponse())
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const promise = request()
    await vi.advanceTimersByTimeAsync(60_000)
    const response = await promise

    expect(response.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('exhausts the retry budget then surfaces a typed provider error', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(503))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const promise = request()
    const rejection = expect(promise).rejects.toMatchObject({
      code: ErrorCode.AI_PROVIDER_ERROR,
    })
    await vi.advanceTimersByTimeAsync(60_000)
    await rejection

    expect(fetchMock).toHaveBeenCalledTimes(PROVIDER_MAX_RETRIES + 1)
  })

  it('classifies 429 as AI_PROVIDER_RATE_LIMITED once retries run out', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(429, { 'retry-after': '1' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const promise = request()
    const rejection = expect(promise).rejects.toMatchObject({
      code: ErrorCode.AI_PROVIDER_RATE_LIMITED,
    })
    await vi.advanceTimersByTimeAsync(60_000)
    await rejection
  })

  it('aborts immediately, without retrying, when the signal fires mid-backoff', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(429, { 'retry-after': '30' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const controller = new AbortController()
    const promise = request(controller.signal)
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never retries a non-retryable 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(401))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(request()).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('classifies a timeout abort as AI_PROVIDER_TIMEOUT', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('Request timed out', 'TimeoutError')) as unknown as typeof fetch

    await expect(request()).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_TIMEOUT })
  })

  it('classifies a network failure as AI_PROVIDER_UNREACHABLE', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch

    // Its own code, not the generic provider error: the UI says "check your
    // connection" for this one (use-ai-harness-chat's friendly copy).
    await expect(request()).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_UNREACHABLE })
  })
})
