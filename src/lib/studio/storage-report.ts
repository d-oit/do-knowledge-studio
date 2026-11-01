/**
 * Storage usage reporting for the settings view (Plan 192 follow-up).
 *
 * Two derived stores grow without the user asking: the semantic index (vectors
 * in memory) and the model cache (bytes in Cache Storage). Both are
 * re-creatable, so the honest thing is to show their size and let the user drop
 * them deliberately rather than to hide the cost until storage runs out.
 *
 * All of it is browser-only and every failure path returns "unavailable"
 * instead of throwing: a settings page that crashes because `caches` is blocked
 * is worse than one that says it cannot measure.
 */

import { logger } from '@/lib/logging/logger'
import { MODEL_CACHE_MAX_BYTES, MODEL_CACHE_NAME } from './pwa-cache'

const log = logger.child({ area: 'storage' })

/** Bytes in a kibibyte; Cache API budgets are quoted in these units. */
const BYTES_PER_UNIT = 1024
/** Display units, ascending. */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const
/** One decimal place is enough for a size a user is deciding to delete. */
const BYTE_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** Measured size of the embedding-model cache. */
export interface ModelCacheUsage {
  /** False when the Cache API is missing or refused to open the cache. */
  available: boolean
  /** Number of cached responses. */
  entries: number
  /** Summed `content-length`; an entry that omits it counts as zero. */
  bytes: number
  /** Budget the worker evicts against. */
  budgetBytes: number
}

/** Formats a byte count for display, e.g. `24.8 MB`. */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${BYTE_UNITS[0]}`
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
    BYTE_UNITS.length - 1,
  )
  return `${BYTE_FORMAT.format(bytes / BYTES_PER_UNIT ** exponent)} ${BYTE_UNITS[exponent]}`
}

/** Cache Storage handle, or null when the environment has none. */
const cacheStorage = (): CacheStorage | null =>
  typeof caches === 'undefined' ? null : caches

/**
 * Measures the model cache.
 *
 * Reads `content-length` rather than the body: downloading 25 MB of weights to
 * report their size would defeat the purpose of reporting it.
 */
export const readModelCacheUsage = async (): Promise<ModelCacheUsage> => {
  const storage = cacheStorage()
  const empty: ModelCacheUsage = {
    available: storage !== null,
    entries: 0,
    bytes: 0,
    budgetBytes: MODEL_CACHE_MAX_BYTES,
  }
  if (storage === null) return empty

  try {
    const cache = await storage.open(MODEL_CACHE_NAME)
    const requests = await cache.keys()
    let bytes = 0
    for (const request of requests) {
      const response = await cache.match(request)
      bytes += Number(response?.headers.get('content-length') ?? 0) || 0
    }
    return { ...empty, entries: requests.length, bytes }
  } catch (error) {
    // Storage blocked (private mode) or the cache was invalidated. The caller
    // still gets a shape it can render.
    log.warn('Model cache usage could not be read', { error })
    return { ...empty, available: false }
  }
}

/**
 * Deletes the model cache so the next semantic search re-downloads it.
 *
 * Returns whether anything was deleted, so the UI can distinguish "cleared" from
 * "there was nothing there" rather than always claiming success.
 */
export const clearModelCache = async (): Promise<boolean> => {
  const storage = cacheStorage()
  if (storage === null) return false
  try {
    return await storage.delete(MODEL_CACHE_NAME)
  } catch (error) {
    log.warn('Model cache could not be cleared', { error })
    return false
  }
}
