import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isSafeMethod,
  isAllowlistedApiRequest,
  isUncacheableRequest,
  isUncacheableResponse,
  clearAppCaches,
  getAppCacheNames,
} from './pwa-cache'

describe('pwa-cache policy predicates', () => {
  describe('isSafeMethod', () => {
    it('allows GET and HEAD', () => {
      expect(isSafeMethod('GET')).toBe(true)
      expect(isSafeMethod('get')).toBe(true)
      expect(isSafeMethod('HEAD')).toBe(true)
      expect(isSafeMethod('head')).toBe(true)
    })

    it('rejects non-idempotent or non-GET/HEAD methods', () => {
      expect(isSafeMethod('POST')).toBe(false)
      expect(isSafeMethod('PUT')).toBe(false)
      expect(isSafeMethod('PATCH')).toBe(false)
      expect(isSafeMethod('DELETE')).toBe(false)
      expect(isSafeMethod('OPTIONS')).toBe(false)
    })
  })

  describe('isAllowlistedApiRequest', () => {
    const origin = 'https://app.example.com'

    it('accepts allowlisted same-origin API routes', () => {
      expect(isAllowlistedApiRequest(new URL('https://app.example.com/api'), origin)).toBe(true)
      expect(isAllowlistedApiRequest(new URL('https://app.example.com/api/'), origin)).toBe(true)
    })

    it('rejects cross-origin requests', () => {
      expect(isAllowlistedApiRequest(new URL('https://evil.com/api'), origin)).toBe(false)
      expect(isAllowlistedApiRequest(new URL('https://openrouter.ai/api/v1/chat'), origin)).toBe(false)
    })

    it('rejects non-allowlisted API routes (AI chat, signaling, user subpaths)', () => {
      expect(isAllowlistedApiRequest(new URL('https://app.example.com/api/chat'), origin)).toBe(false)
      expect(isAllowlistedApiRequest(new URL('https://app.example.com/api/user/credentials'), origin)).toBe(false)
      expect(isAllowlistedApiRequest(new URL('https://app.example.com/api/signaling'), origin)).toBe(false)
    })
  })

  describe('isUncacheableRequest', () => {
    it('returns false for clean GET/HEAD requests without auth or no-store headers', () => {
      expect(isUncacheableRequest('GET', {})).toBe(false)
      expect(isUncacheableRequest('HEAD', new Headers())).toBe(false)
    })

    it('returns true for non-safe methods', () => {
      expect(isUncacheableRequest('POST', {})).toBe(true)
      expect(isUncacheableRequest('DELETE', {})).toBe(true)
    })

    it('returns true when Authorization or Cookie headers are present', () => {
      expect(isUncacheableRequest('GET', { authorization: 'Bearer secret-token' })).toBe(true)
      expect(isUncacheableRequest('GET', { cookie: 'session=xyz' })).toBe(true)

      const headers = new Headers()
      headers.set('Authorization', 'Bearer 123')
      expect(isUncacheableRequest('GET', headers)).toBe(true)
    })

    it('returns true when Cache-Control or Pragma no-store/no-cache directives are present', () => {
      expect(isUncacheableRequest('GET', { 'cache-control': 'no-store' })).toBe(true)
      expect(isUncacheableRequest('GET', { 'cache-control': 'max-age=0, no-cache' })).toBe(true)
      expect(isUncacheableRequest('GET', { pragma: 'no-cache' })).toBe(true)
    })
  })

  describe('isUncacheableResponse', () => {
    it('returns false for HTTP 200 OK without private/no-store headers', () => {
      expect(isUncacheableResponse(200, { 'cache-control': 'public, max-age=3600' })).toBe(false)
      expect(isUncacheableResponse(200, new Headers())).toBe(false)
    })

    it('returns true for non-successful HTTP status codes', () => {
      expect(isUncacheableResponse(401, {})).toBe(true)
      expect(isUncacheableResponse(403, {})).toBe(true)
      expect(isUncacheableResponse(404, {})).toBe(true)
      expect(isUncacheableResponse(500, {})).toBe(true)
    })

    it('returns true when response Cache-Control has private or no-store directives', () => {
      expect(isUncacheableResponse(200, { 'cache-control': 'private, max-age=0' })).toBe(true)
      expect(isUncacheableResponse(200, { 'cache-control': 'no-store' })).toBe(true)

      const headers = new Headers()
      headers.set('Cache-Control', 'private')
      expect(isUncacheableResponse(200, headers)).toBe(true)
    })
  })

  describe('clearAppCaches and getAppCacheNames', () => {
    beforeEach(() => {
      const keysMap = new Map<string, unknown>()
      keysMap.set('dks-static-v6', {})
      keysMap.set('dks-api-v2', {})

      const mockCaches = {
        keys: vi.fn(async () => Array.from(keysMap.keys())),
        delete: vi.fn(async (key: string) => {
          const existed = keysMap.has(key)
          keysMap.delete(key)
          return existed
        }),
      }

      vi.stubGlobal('caches', mockCaches)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('lists current cache names', async () => {
      const names = await getAppCacheNames()
      expect(names).toEqual(['dks-static-v6', 'dks-api-v2'])
    })

    it('purges all cache storage containers and returns deleted names', async () => {
      const deleted = await clearAppCaches()
      expect(deleted).toEqual(['dks-static-v6', 'dks-api-v2'])

      const remaining = await getAppCacheNames()
      expect(remaining).toEqual([])
    })
  })
})
