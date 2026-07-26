'use client'

import { useCallback, useEffect, useRef } from 'react'

export type RateLimitDecision = {
  allowed: boolean
  count: number
  limit: number
  retryAfterMs?: number
}

interface UseRateLimiterOptions {
  maxRequests?: number
  windowMs?: number
}

const DEFAULT_MAX_REQUESTS = 10
const DEFAULT_WINDOW_MS = 60_000

export function useRateLimiter({
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
}: UseRateLimiterOptions = {}) {
  const configRef = useRef({ maxRequests, windowMs })

  useEffect(() => {
    configRef.current = { maxRequests, windowMs }
  }, [maxRequests, windowMs])
  const timestampsRef = useRef<number[]>([])

  const canRequest = useCallback((): RateLimitDecision => {
    const { maxRequests: limit, windowMs: wMs } = configRef.current
    const now = Date.now()
    const windowStart = now - wMs

    timestampsRef.current = timestampsRef.current.filter((ts) => ts > windowStart)

    if (timestampsRef.current.length >= limit) {
      const oldest = timestampsRef.current[0]
      const retryAfterMs = oldest + wMs - now

      return {
        allowed: false,
        count: timestampsRef.current.length,
        limit,
        retryAfterMs,
      }
    }

    timestampsRef.current.push(now)

    return {
      allowed: true,
      count: timestampsRef.current.length,
      limit,
    }
  }, [])

  return { canRequest }
}
