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
/**
 * Origin-level storage diagnostics (issue #1156).
 *
 * Wraps `navigator.storage` — the Storage API's StorageManager. The numbers it
 * returns are estimates by spec: the browser may round usage, exclude some
 * storage, or change quota over time, so the UI labels them as estimates and
 * never treats them as exact disk accounting. Persistence here only asks the
 * browser not to evict this origin under storage pressure; it is not a backup
 * and cannot survive manual site-data deletion or device loss. Nothing here is
 * ever transmitted anywhere — the diagnostics stay in the browser.
 */

/** Usage ratio of reported quota at which the panel warns (80%). */
export const QUOTA_WARNING_RATIO = 0.8

/** Estimated origin usage and quota; either side may be unknown. */
export interface OriginEstimate {
  usageBytes: number | null
  quotaBytes: number | null
}

/** Snapshot of the origin's storage health. */
export interface OriginStorageState {
  /** False when the environment has none of the StorageManager methods. */
  supported: boolean
  /** Null when the estimate call failed or returned nothing usable. */
  estimate: OriginEstimate | null
  /** Null until known; `false` means persistence was not granted. */
  persisted: boolean | null
  /** Whether the browser exposes an explicit persistence request. */
  persistenceRequestSupported: boolean
}

/** StorageManager handle, or null in environments without the API. */
const storageManager = (): StorageManager | null => {
  if (typeof navigator === 'undefined' || typeof navigator.storage === 'undefined') return null
  return navigator.storage
}

/**
 * Reads origin usage/quota and persistence status. Never throws: browsers that
 * lack the API, reject calls, or return unusable values produce a state the
 * settings view can render instead of crashing.
 */
export const readOriginStorage = async (): Promise<OriginStorageState> => {
  const manager = storageManager()
  if (manager === null) {
    return {
      supported: false,
      estimate: null,
      persisted: null,
      persistenceRequestSupported: false,
    }
  }

  const canEstimate = typeof manager.estimate === 'function'
  const canReadPersistence = typeof manager.persisted === 'function'
  const persistenceRequestSupported = typeof manager.persist === 'function'
  const supported = canEstimate || canReadPersistence || persistenceRequestSupported
  const empty: OriginStorageState = {
    supported,
    estimate: null,
    persisted: null,
    persistenceRequestSupported,
  }
  if (!supported) return empty

  const estimatePromise = canEstimate
    ? Promise.resolve()
      .then(() => manager.estimate())
      .catch((error: unknown) => {
        log.warn('Origin storage estimate could not be read', { error })
        return null
      })
    : Promise.resolve(null)
  const persistencePromise = canReadPersistence
    ? Promise.resolve()
      .then(() => manager.persisted())
      .catch((error: unknown) => {
        log.warn('Persistent storage status could not be read', { error })
        return null
      })
    : Promise.resolve(null)
  const [estimateValue, persistedValue] = await Promise.all([estimatePromise, persistencePromise])

  let estimate: OriginEstimate | null = null
  if (estimateValue && typeof estimateValue === 'object') {
    estimate = {
      usageBytes:
        typeof estimateValue.usage === 'number' && Number.isFinite(estimateValue.usage)
          ? estimateValue.usage
          : null,
      quotaBytes:
        typeof estimateValue.quota === 'number' && Number.isFinite(estimateValue.quota)
          ? estimateValue.quota
          : null,
    }
  }

  return {
    supported,
    estimate,
    persisted: typeof persistedValue === 'boolean' ? persistedValue : null,
    persistenceRequestSupported,
  }
}

/**
 * Requests persistent storage for the origin. Returns whether the browser
 * granted it; `supported: false` means no API exists. Never throws — a denial
 * or rejected promise is a normal outcome, not a crash.
 */
export const requestPersistence = async (): Promise<{ supported: boolean; granted: boolean }> => {
  const manager = storageManager()
  if (manager === null || typeof manager.persist !== 'function') {
    return { supported: false, granted: false }
  }
  try {
    return { supported: true, granted: (await manager.persist()) === true }
  } catch (error) {
    log.warn('Persistent storage request was declined', { error })
    return { supported: true, granted: false }
  }
}

/** Round percentage of reported quota the estimate claims is used, or null when unknowable. */
export const estimateUsagePercent = (estimate: OriginEstimate | null): number | null => {
  if (estimate === null) return null
  const { usageBytes, quotaBytes } = estimate
  if (usageBytes === null || quotaBytes === null || quotaBytes <= 0) return null
  return Math.round((usageBytes / quotaBytes) * 100)
}

/**
 * True when estimated usage reaches the warning ratio of the reported quota.
 * Unknown or zero quota never warns. The raw ratio is compared, not the
 * rounded percentage, so the warning fires exactly at the documented ratio.
 */
export const isNearQuota = (
  estimate: OriginEstimate | null,
  ratio: number = QUOTA_WARNING_RATIO,
): boolean => {
  if (estimate === null) return false
  const { usageBytes, quotaBytes } = estimate
  if (usageBytes === null || quotaBytes === null || quotaBytes <= 0) return false
  return usageBytes / quotaBytes >= ratio
}
