import { useState, useCallback, useRef } from 'react';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_THRESHOLD = 15;

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
    if (count === 0) return 'none';
    const ratio = count / limit;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  }, [getRateLimitInfo]);

  return {
    trackRequest,
    getRateLimitInfo,
    getRateLimitLevel,
  };
}
