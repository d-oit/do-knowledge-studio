import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isSafeMethod,
  isUncacheableRequest,
  isUncacheableResponse,
  isModelAssetUrl,
  entriesToEvict,
  MODEL_ASSET_HOSTS,
  MODEL_CACHE_MAX_BYTES,
  MODEL_CACHE_NAME,
  clearAppCaches,
  getAppCacheNames,
} from './pwa-cache'
import { readFileSync } from 'node:fs'

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

  describe('model asset caching', () => {
    it('recognises the hosts that serve the embedding model', () => {
      expect(isModelAssetUrl(new URL('https://huggingface.co/Xenova/m/resolve/main/x.onnx'))).toBe(true)
      expect(isModelAssetUrl(new URL('https://cdn-lfs.hf.co/repo/x.onnx'))).toBe(true)
      // Same-origin assets and unrelated CDNs stay in their own strategies.
      expect(isModelAssetUrl(new URL('https://app.example.com/model.onnx'))).toBe(false)
      expect(isModelAssetUrl(new URL('https://cdn.jsdelivr.net/npm/x.onnx'))).toBe(false)
    })

    it('names a model cache distinct from the shell cache', () => {
      expect(MODEL_CACHE_NAME).toBe('dks-model-v1')
      expect(MODEL_CACHE_NAME).not.toBe('dks-static-v6')
    })

    it('keeps the service worker host list in step with this module', () => {
      // The SW cannot import TypeScript, so the lists are duplicated by
      // necessity. A drift here would only surface offline, on the one path
      // nobody exercises — assert equality instead of trusting the comment.
      const sw = readFileSync('public/sw.js', 'utf8')
      for (const host of MODEL_ASSET_HOSTS) {
        expect(sw, `public/sw.js is missing ${host}`).toContain(`"${host}"`)
      }
      expect(sw).toContain(`const MODEL_CACHE = "${MODEL_CACHE_NAME}"`)
      // The byte budget is duplicated for the same reason; a drift here would
      // let the cache grow past what the app believes it caps at. The service
      // worker writes it as an expression for readability, so pin the value and
      // the expression separately rather than re-deriving one from the other.
      expect(MODEL_CACHE_MAX_BYTES).toBe(120 * 1024 * 1024)
      expect(sw).toContain('const MODEL_CACHE_MAX_BYTES = 120 * 1024 * 1024;')
    })
  })

  describe('model cache eviction', () => {
    const entry = (url: string, bytes: number) => ({ url, bytes })

    it('keeps everything when the total fits', () => {
      expect(entriesToEvict([entry('a', 10), entry('b', 10)], 100)).toEqual([])
    })

    it('drops oldest entries until the total fits', () => {
      const entries = [entry('a', 40), entry('b', 40), entry('c', 40)]
      expect(entriesToEvict(entries, 100)).toEqual(['a'])
      expect(entriesToEvict(entries, 80)).toEqual(['a'])
      expect(entriesToEvict(entries, 40)).toEqual(['a', 'b'])
    })

    it('evicts everything for a zero or negative budget', () => {
      expect(entriesToEvict([entry('a', 1)], 0)).toEqual(['a'])
      expect(entriesToEvict([entry('a', 1)], -5)).toEqual(['a'])
    })

    it('treats an unmeasurable entry as zero bytes rather than dropping the wrong things', () => {
      // A missing content-length counts as zero, so an entry that reports
      // nothing cannot push a measurable sibling out of the budget.
      expect(entriesToEvict([entry('unknown', 0), entry('small', 10)], 10)).toEqual([])
      // And when eviction really is needed, the measurable entry is the one
      // that frees space.
      expect(entriesToEvict([entry('big', 60), entry('unknown', 0)], 50)).toEqual(['big'])
    })
  })

  describe('clearAppCaches and getAppCacheNames', () => {
    beforeEach(() => {
      const keysMap = new Map<string, unknown>()
      keysMap.set('dks-static-v6', {})
      keysMap.set('dks-model-v1', {})

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
      expect(names).toEqual(['dks-static-v6', 'dks-model-v1'])
    })

    it('purges all cache storage containers and returns deleted names', async () => {
      const deleted = await clearAppCaches()
      expect(deleted).toEqual(['dks-static-v6', 'dks-model-v1'])

      const remaining = await getAppCacheNames()
      expect(remaining).toEqual([])
    })
  })
})
