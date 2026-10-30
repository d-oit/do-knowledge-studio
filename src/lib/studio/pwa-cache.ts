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
