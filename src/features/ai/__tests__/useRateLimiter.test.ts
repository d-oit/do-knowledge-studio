// Wave 3 — work in progress.
// useRateLimiter source is still being finalised. Remove it.skip once stable.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRateLimiter } from '../useRateLimiter';

const RATE_LIMIT_THRESHOLD = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.skip('starts with no requests tracked', () => {
    const { result } = renderHook(() => useRateLimiter());
    expect(result.current.getRateLimitInfo().count).toBe(0);
    expect(result.current.getRateLimitInfo().limit).toBe(RATE_LIMIT_THRESHOLD);
    expect(result.current.getRateLimitLevel()).toBe('none');
  });

  it.skip('allows requests up to the threshold', () => {
    const { result } = renderHook(() => useRateLimiter());
    for (let i = 0; i < RATE_LIMIT_THRESHOLD; i++) {
      const decision = result.current.canRequest();
      expect(decision.allowed).toBe(true);
      act(() => { result.current.trackRequest(); });
    }
  });

  it.skip('rejects requests at the threshold with retry-after', () => {
    vi.setSystemTime(new Date('2026-06-22T01:00:00Z'));
    const { result } = renderHook(() => useRateLimiter());
    for (let i = 0; i < RATE_LIMIT_THRESHOLD; i++) {
      act(() => { result.current.trackRequest(); });
    }
    const decision = result.current.canRequest();
    expect(decision.allowed).toBe(false);
    expect(decision.level).toBe('high');
    expect(typeof decision.retryAfterMs).toBe('number');
    expect(decision.retryAfterMs).toBeGreaterThan(0);
  });

  it.skip('computes a low / medium level for partial usage', () => {
    vi.setSystemTime(new Date('2026-06-22T02:00:00Z'));
    const { result } = renderHook(() => useRateLimiter());
    for (let i = 0; i < 3; i++) {
      act(() => { result.current.trackRequest(); });
    }
    expect(result.current.getRateLimitLevel()).toBe('low');

    for (let i = 0; i < 5; i++) {
      act(() => { result.current.trackRequest(); });
    }
    expect(result.current.getRateLimitLevel()).toBe('medium');
  });

  it.skip('expires old timestamps after the window passes', () => {
    vi.setSystemTime(new Date('2026-06-22T03:00:00Z'));
    const { result } = renderHook(() => useRateLimiter());
    for (let i = 0; i < RATE_LIMIT_THRESHOLD; i++) {
      act(() => { result.current.trackRequest(); });
    }
    expect(result.current.canRequest().allowed).toBe(false);

    act(() => { vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000); });

    expect(result.current.getRateLimitInfo().count).toBe(0);
    expect(result.current.canRequest().allowed).toBe(true);
  });

  it.skip('shares state between hook instances', () => {
    vi.setSystemTime(new Date('2026-06-22T04:00:00Z'));
    const a = renderHook(() => useRateLimiter());
    const b = renderHook(() => useRateLimiter());
    act(() => { a.result.current.trackRequest(); });
    expect(b.result.current.getRateLimitInfo().count).toBe(1);
  });
});
