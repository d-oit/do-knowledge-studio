// @vitest-environment node
//
// Node, not jsdom: the measurement reads real `Response` headers from a fake
// Cache Storage, and jsdom has no `Response`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODEL_CACHE_MAX_BYTES, MODEL_CACHE_NAME } from './pwa-cache'
import { clearModelCache, formatBytes, readModelCacheUsage } from './storage-report'

const responseWith = (bytes: number): Response =>
  new Response('x', { headers: { 'content-length': String(bytes) } })

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
