// @vitest-environment node
//
// Node, not jsdom: the measurement reads real `Response` headers from a fake
// Cache Storage, and jsdom has no `Response`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODEL_CACHE_MAX_BYTES, MODEL_CACHE_NAME } from './pwa-cache'
import {
  clearModelCache,
  estimateUsagePercent,
  formatBytes,
  isNearQuota,
  QUOTA_WARNING_RATIO,
  readModelCacheUsage,
  readOriginStorage,
  requestPersistence,
} from './storage-report'

const responseWith = (bytes: number): Response =>
  new Response('x', { headers: { 'content-length': String(bytes) } })
const MB = 1024 * 1024

/** Fake Cache Storage exposing just what the report touches. */
const stubCacheStorage = (entries: { bytes: number }[]) => {
  const requests = entries.map((_, index) => new Request(`https://cdn.example.com/${index}.onnx`))
  const cache = {
    keys: vi.fn(async () => requests),
    match: vi.fn(async (request: Request) => {
      const index = requests.indexOf(request)
      return index === -1 ? undefined : responseWith(entries[index].bytes)
    }),
  }
  const storage = {
    open: vi.fn(async (name: string) => {
      if (name !== MODEL_CACHE_NAME) throw new Error(`unexpected cache ${name}`)
      return cache
    }),
    delete: vi.fn(async () => true),
  }
  vi.stubGlobal('caches', storage)
  return { cache, storage }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('formatBytes', () => {
  it('scales into the largest whole unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
  })

  it('keeps one decimal place for a size between units', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(120 * 1024 * 1024)).toBe('120 MB')
  })

  it('treats a negative or non-finite count as zero rather than printing NaN', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('readModelCacheUsage', () => {
  it('sums content-length across cached model files', async () => {
    stubCacheStorage([{ bytes: 20 }, { bytes: 30 }])

    const usage = await readModelCacheUsage()

    expect(usage).toEqual({
      available: true,
      entries: 2,
      bytes: 50,
      budgetBytes: MODEL_CACHE_MAX_BYTES,
    })
  })

  it('counts an entry with no content-length as zero bytes', async () => {
    const cache = {
      keys: vi.fn(async () => [new Request('https://cdn.example.com/x.onnx')]),
      match: vi.fn(async () => new Response('x')),
    }
    vi.stubGlobal('caches', { open: vi.fn(async () => cache), delete: vi.fn(async () => true) })

    const usage = await readModelCacheUsage()

    expect(usage.entries).toBe(1)
    expect(usage.bytes).toBe(0)
  })

  it('reports unavailable when the Cache API is missing', async () => {
    vi.stubGlobal('caches', undefined)

    const usage = await readModelCacheUsage()

    expect(usage.available).toBe(false)
    expect(usage.entries).toBe(0)
    expect(usage.bytes).toBe(0)
  })

  it('reports unavailable instead of throwing when storage refuses to open', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn(async () => {
        throw new Error('storage blocked')
      }),
      delete: vi.fn(async () => true),
    })

    const usage = await readModelCacheUsage()

    expect(usage.available).toBe(false)
    expect(usage.entries).toBe(0)
  })
})

describe('clearModelCache', () => {
  it('deletes the model cache by name, not the shell cache', async () => {
    const { storage } = stubCacheStorage([{ bytes: 10 }])

    expect(await clearModelCache()).toBe(true)
    expect(storage.delete).toHaveBeenCalledWith(MODEL_CACHE_NAME)
  })

  it('returns false when storage refuses the delete', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({ keys: vi.fn(async () => []), match: vi.fn() })),
      delete: vi.fn(async () => {
        throw new Error('blocked')
      }),
    })

    expect(await clearModelCache()).toBe(false)
  })

  it('returns false with no Cache API at all', async () => {
    vi.stubGlobal('caches', undefined)

    expect(await clearModelCache()).toBe(false)
  })
})

describe('readOriginStorage', () => {
  it('reports estimated usage, quota and persistence when supported', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => ({ usage: 250 * MB, quota: 1000 * MB })),
        persisted: vi.fn(async () => true),
        persist: vi.fn(async () => true),
      },
    })

    expect(await readOriginStorage()).toEqual({
      supported: true,
      estimate: { usageBytes: 250 * MB, quotaBytes: 1000 * MB },
      persisted: true,
      persistenceRequestSupported: true,
    })
  })

  it('reports unsupported when navigator.storage is missing', async () => {
    vi.stubGlobal('navigator', {})

    expect(await readOriginStorage()).toEqual({
      supported: false,
      estimate: null,
      persisted: null,
      persistenceRequestSupported: false,
    })
  })

  it('keeps the panel usable when the estimate call rejects', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => {
          throw new Error('blocked')
        }),
        persisted: vi.fn(async () => false),
      },
    })

    const state = await readOriginStorage()
    expect(state.supported).toBe(true)
    expect(state.estimate).toBeNull()
    expect(state.persisted).toBe(false)
    expect(state.persistenceRequestSupported).toBe(false)
  })

  it('normalizes a null estimate result to unknown rather than crashing', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => null),
        persisted: vi.fn(async () => false),
      },
    })

    expect((await readOriginStorage()).estimate).toBeNull()
  })

  it('normalizes unavailable usage and quota fields independently', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => ({ usage: null, quota: undefined })),
        persisted: vi.fn(async () => false),
      },
    })

    expect((await readOriginStorage()).estimate).toEqual({ usageBytes: null, quotaBytes: null })
  })

  it('keeps persisted unknown when the status call rejects', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => ({ usage: 1, quota: 2 })),
        persisted: vi.fn(async () => {
          throw new Error('blocked')
        }),
      },
    })

    expect((await readOriginStorage()).persisted).toBeNull()
  })

  it('reports available methods without claiming unsupported capabilities', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn(async () => false) } })

    expect(await readOriginStorage()).toEqual({
      supported: true,
      estimate: null,
      persisted: false,
      persistenceRequestSupported: false,
    })
  })

  it('reports unsupported when storage methods are missing entirely', async () => {
    vi.stubGlobal('navigator', { storage: {} })

    expect(await readOriginStorage()).toEqual({
      supported: false,
      estimate: null,
      persisted: null,
      persistenceRequestSupported: false,
    })
  })
})

describe('requestPersistence', () => {
  it('reports a grant when the browser accepts', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn(async () => true) },
    })

    expect(await requestPersistence()).toEqual({ supported: true, granted: true })
  })

  it('reports a denial when the browser declines', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn(async () => false) },
    })

    expect(await requestPersistence()).toEqual({ supported: true, granted: false })
  })

  it('does not throw when the persist call rejects', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn(async () => {
          throw new Error('refused')
        }),
      },
    })

    expect(await requestPersistence()).toEqual({ supported: true, granted: false })
  })

  it('reports unsupported without a Storage API', async () => {
    vi.stubGlobal('navigator', {})

    expect(await requestPersistence()).toEqual({ supported: false, granted: false })
  })
  it('reports unsupported when the persist method is missing', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn(async () => false) } })

    expect(await requestPersistence()).toEqual({ supported: false, granted: false })
  })
})

describe('estimateUsagePercent / isNearQuota', () => {
  it('computes the rounded percentage of reported quota in use', () => {
    expect(estimateUsagePercent({ usageBytes: 250, quotaBytes: 1000 })).toBe(25)
    expect(estimateUsagePercent({ usageBytes: 899, quotaBytes: 1000 })).toBe(90)
  })

  it('returns null when either side is unknown or quota is empty', () => {
    expect(estimateUsagePercent(null)).toBeNull()
    expect(estimateUsagePercent({ usageBytes: null, quotaBytes: 1000 })).toBeNull()
    expect(estimateUsagePercent({ usageBytes: 10, quotaBytes: null })).toBeNull()
    expect(estimateUsagePercent({ usageBytes: 10, quotaBytes: 0 })).toBeNull()
  })

  it('warns at and above the documented ratio and stays quiet below it', () => {
    expect(QUOTA_WARNING_RATIO).toBe(0.8)
    expect(isNearQuota({ usageBytes: 800, quotaBytes: 1000 })).toBe(true)
    expect(isNearQuota({ usageBytes: 801, quotaBytes: 1000 })).toBe(true)
    expect(isNearQuota({ usageBytes: 799, quotaBytes: 1000 })).toBe(false)
    expect(isNearQuota(null)).toBe(false)
    expect(isNearQuota({ usageBytes: null, quotaBytes: 1000 })).toBe(false)
  })
})
