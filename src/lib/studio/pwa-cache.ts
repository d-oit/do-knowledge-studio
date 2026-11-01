/**
 * PWA Cache Storage utilities and policy predicates for DO Knowledge Studio.
 */

/** Known active cache prefixes or full names. */
export const APP_CACHE_PREFIX = 'dks-'

/**
 * Deletes all CacheStorage caches managed by the application (or all caches if requested).
 * Returns the names of the deleted caches.
 */
export async function clearAppCaches(): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return []
  }
  const keys = await window.caches.keys()
  const deleted: string[] = []
  await Promise.all(
    keys.map(async (key) => {
      const success = await window.caches.delete(key)
      if (success) {
        deleted.push(key)
      }
    }),
  )
  return deleted
}

/**
 * Returns a list of current cache keys in CacheStorage.
 */
export async function getAppCacheNames(): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return []
  }
  return window.caches.keys()
}

/** Explicit same-origin allowlisted API paths eligible for SW caching. */
export const ALLOWED_API_PATHS = new Set(['/api'])

/**
 * Cache Storage name holding the embedding model, kept separate from the shell.
 *
 * Mirrors `MODEL_CACHE` in `public/sw.js`. The shell cache is wiped by every
 * deploy; the model is ~25 MB and should survive that, so clearing the app does
 * not force a re-download.
 */
export const MODEL_CACHE_NAME = 'dks-model-v1'

/**
 * Bytes the model cache may hold before the oldest entries are dropped.
 *
 * Mirrors `MODEL_CACHE_MAX_BYTES` in `public/sw.js` and asserted equal by the
 * policy test. The budget is roughly two full models: enough for a model plus
 * its chunked variants, short of letting a misconfigured host exhaust the
 * origin's storage quota.
 */
export const MODEL_CACHE_MAX_BYTES = 120 * 1024 * 1024

/** One cached model entry, as the eviction policy sees it. */
export interface ModelCacheEntry {
  url: string
  bytes: number
}

/**
 * URLs to drop, oldest first, until the cache fits `maxBytes`.
 *
 * `entries` must be in insertion order (what `Cache.keys()` returns), because
 * that is what "oldest" means here. Pure and total: a negative or zero budget
 * evicts everything, and an unmeasurable entry counts as zero bytes, which can
 * only make eviction more conservative than intended.
 */
export const entriesToEvict = (
  entries: readonly ModelCacheEntry[],
  maxBytes: number = MODEL_CACHE_MAX_BYTES,
): string[] => {
  let total = entries.reduce((sum, entry) => sum + Math.max(0, entry.bytes), 0)
  const evicted: string[] = []
  for (const entry of entries) {
    if (total <= maxBytes) break
    evicted.push(entry.url)
    total -= Math.max(0, entry.bytes)
  }
  return evicted
}

/**
 * Hosts that serve the embedding model to transformers.js.
 *
 * Mirrors `MODEL_HOSTS` in `public/sw.js`, which is plain JS in `public/` and
 * cannot import this module. The two lists are asserted equal by
 * `pwa-cache-policy.test.ts` so a drift shows up as a failing test rather than
 * as an offline-only surprise.
 */
export const MODEL_ASSET_HOSTS: ReadonlySet<string> = new Set([
  'huggingface.co',
  'www.huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs.hf.co',
])

/** Whether a URL serves an embedding model asset served from `MODEL_CACHE_NAME`. */
export function isModelAssetUrl(url: URL): boolean {
  return MODEL_ASSET_HOSTS.has(url.hostname)
}

/** Checks if an HTTP method is safe (GET or HEAD). */
export function isSafeMethod(method: string): boolean {
  const m = method.toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

/** Checks if a request is an allowlisted same-origin API endpoint. */
export function isAllowlistedApiRequest(url: URL, origin: string): boolean {
  if (url.origin !== origin) return false
  const pathname = url.pathname.replace(/\/$/, '')
  return ALLOWED_API_PATHS.has(pathname)
}

/** Checks if a request has sensitive credentials or cache-bypassing headers. */
export function isUncacheableRequest(
  method: string,
  headers: Headers | Record<string, string>,
): boolean {
  if (!isSafeMethod(method)) return true

  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name)
    }
    const lc = name.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lc) return v
    }
    return null
  }

  if (getHeader('authorization') !== null || getHeader('cookie') !== null) {
    return true
  }

  const cacheControl = getHeader('cache-control') || ''
  const pragma = getHeader('pragma') || ''

  if (
    cacheControl.includes('no-store') ||
    cacheControl.includes('no-cache') ||
    pragma.includes('no-cache')
  ) {
    return true
  }

  return false
}

/** Checks if a response has directives blocking caching (private or no-store). */
export function isUncacheableResponse(
  status: number,
  headers: Headers | Record<string, string>,
): boolean {
  if (status < 200 || status >= 300) return true

  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name)
    }
    const lc = name.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lc) return v
    }
    return null
  }

  const cacheControl = getHeader('cache-control') || ''
  if (cacheControl.includes('private') || cacheControl.includes('no-store')) {
    return true
  }

  return false
}
