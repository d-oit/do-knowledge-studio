import { useCallback, useRef } from 'react';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_THRESHOLD = 15;

export interface RateLimitDecision {
  allowed: boolean;
  level: 'none' | 'low' | 'medium' | 'high';
  retryAfterMs?: number;
}

export function useRateLimiter() {
  const requestTimestamps = useRef<number[]>([]);

  const trackRequest = useCallback(() => {
    const now = Date.now();
    requestTimestamps.current = requestTimestamps.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    requestTimestamps.current.push(now);
  }, []);

  const getRateLimitInfo = useCallback(() => {
    const now = Date.now();
    const recent = requestTimestamps.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    return { count: recent.length, limit: RATE_LIMIT_THRESHOLD };
  }, []);

  const getRateLimitLevel = useCallback(() => {
    const { count, limit } = getRateLimitInfo();
    if (count === 0) return 'none' as const;
    const ratio = count / limit;
    if (ratio >= 0.8) return 'high' as const;
    if (ratio >= 0.5) return 'medium' as const;
    return 'low' as const;
  }, [getRateLimitInfo]);

  const canRequest = useCallback((): RateLimitDecision => {
    const { count, limit } = getRateLimitInfo();
    const level = getRateLimitLevel();
    if (count < limit) {
      return { allowed: true, level };
    }
    const now = Date.now();
    const oldest = requestTimestamps.current[0] ?? now;
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    return { allowed: false, level, retryAfterMs: Math.max(0, retryAfterMs) };
  }, [getRateLimitInfo, getRateLimitLevel]);

  return {
    trackRequest,
    getRateLimitInfo,
    getRateLimitLevel,
    canRequest,
  };
}
