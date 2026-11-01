// @vitest-environment node
//
// Node, not jsdom: this harness evaluates `public/sw.js` in a stand-in service
// worker scope and needs real `Request`/`Response`/`Headers` from undici.
// jsdom has none of them, and a hand-rolled fake would test the fake.

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Executes `public/sw.js` instead of reading it.
 *
 * `pwa-cache-policy.test.ts` asserts that the service worker *mentions* the same
 * cache names and hosts as `pwa-cache.ts`. That catches drift, not behaviour: it
 * passed while `cache.put` shared a `try` with the fetch and reported every
 * storage rejection as "Service unavailable", which kept semantic search from
 * ever loading — a defect only a driving test could see.
 *
 * The service worker is plain JS served from `public/`, so it cannot be
 * imported. It is evaluated with a fake `self` that captures the handlers it
 * registers, and the strategies are then driven through those handlers with a
 * controllable `caches` and `fetch`. What is under test is the real routing and
 * the real error handling, not a reimplementation of them.
 */

/** Handlers `sw.js` registered, by event type. */
type HandlerMap = Map<string, (event: unknown) => void>

/** What a driven fetch event needs from the service-worker `event` object. */
interface FetchEventLike {
  request: Request
  respondWith: (response: Promise<Response>) => void
}

/** Cache API surface the worker uses, in the subset this harness drives. */
interface FakeCache {
  put: ReturnType<typeof vi.fn>
  match: ReturnType<typeof vi.fn>
  keys: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  add: ReturnType<typeof vi.fn>
}

/** One loaded service worker plus the levers to drive it. */
interface LoadedWorker {
  handlers: HandlerMap
  self: {
    skipWaiting: ReturnType<typeof vi.fn>
    clients: { claim: ReturnType<typeof vi.fn> }
  }
  /** Runs the `fetch` handler and returns whatever it passed to `respondWith`. */
  dispatchFetch: (request: Request) => Promise<Response>
  /** Runs the `install` handler to completion. */
  dispatchInstall: () => Promise<void>
}

const makeCache = (overrides: Partial<FakeCache> = {}): FakeCache => ({
  put: vi.fn(async () => undefined),
  match: vi.fn(async () => undefined),
  keys: vi.fn(async () => []),
  delete: vi.fn(async () => true),
  add: vi.fn(async () => undefined),
  ...overrides,
})

/** Origin the fake worker scope claims to be served from. */
const SCOPE_ORIGIN = 'https://app.example.com'

/**
 * `Request` that resolves relative URLs the way a service worker does.
 *
 * The precache manifest lists paths like `/` and `/_next/static/chunk.js`; a
 * worker resolves those against its own script URL, while Node's `Request`
 * throws `ERR_INVALID_URL`. Without this the harness would fail on correct
 * code, and a harness that cannot pass on correct code proves nothing.
 */
class ScopedRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, SCOPE_ORIGIN).href : input, init)
  }
}

/**
 * Evaluates the worker with the supplied cache/fetch implementations.
 *
 * `console.warn` is silenced: the worker logs every handled failure on purpose,
 * and the assertions are about what it *returns*, not about the log.
 */
const loadWorker = (
  cachesImpl: unknown,
  fetchImpl: (request: Request) => Promise<Response>,
): LoadedWorker => {
  const handlers: HandlerMap = new Map()
  const self = {
    location: { origin: SCOPE_ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void): void => {
      handlers.set(type, handler)
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  }
  const quietConsole = { ...console, warn: vi.fn(), error: vi.fn() }

  const source = readFileSync('public/sw.js', 'utf8')
  const factory = new Function(
    'self',
    'caches',
    'fetch',
    'console',
    'Request',
    source,
  ) as (
    selfScope: unknown,
    cacheStorage: unknown,
    fetchFn: unknown,
    logger: unknown,
    requestClass: typeof Request,
  ) => void
  factory(self, cachesImpl, fetchImpl, quietConsole, ScopedRequest)

  return {
    handlers,
    self,
    dispatchFetch: async (request: Request) => {
      const handler = handlers.get('fetch')
      if (handler === undefined) throw new Error('sw.js registered no fetch handler')
      let responded: Promise<Response> | null = null
      const event: FetchEventLike = {
        request,
        respondWith: (response) => {
          responded = response
        },
      }
      handler(event)
      if (responded === null) throw new Error('fetch handler did not respond')
      return await responded
    },
    dispatchInstall: async () => {
      const handler = handlers.get('install')
      if (handler === undefined) throw new Error('sw.js registered no install handler')
      const pending: Promise<unknown>[] = []
      handler({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) })
      await Promise.all(pending)
    },
  }
}

const ok = (body: string, contentType = 'application/json'): Response =>
  new Response(body, { status: 200, headers: { 'content-type': contentType } })

describe('service worker runtime', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('cache write failures are not network failures', () => {
    it('returns the fetched model response when the cache write rejects', async () => {
      // This is the regression that shipped: the write and the fetch shared a
      // try, so a rejected `cache.put` was reported as 503 and transformers.js
      // surfaced "Service unavailable" even though the bytes had arrived.
      const cache = makeCache({
        put: vi.fn(async () => {
          throw new DOMException('quota exceeded', 'QuotaExceededError')
        }),
      })
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        async () => ok('{"model":true}'),
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/config.json'),
      )

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('{"model":true}')
      expect(cache.put).toHaveBeenCalledOnce()
    })

    it('returns the fetched shell asset when its cache write rejects', async () => {
      const cache = makeCache({
        put: vi.fn(async () => {
          throw new DOMException('quota exceeded', 'QuotaExceededError')
        }),
      })
      const worker = loadWorker(
        {
          open: vi.fn(async () => cache),
          match: vi.fn(async () => undefined),
        },
        async () => ok('console.log(1)', 'application/javascript'),
      )

      const response = await worker.dispatchFetch(
        new Request('https://app.example.com/_next/static/chunk.js'),
      )

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('console.log(1)')
    })
  })

  describe('maintenance failures stay out of the response path', () => {
    it('serves the model when eviction cannot read the cache index', async () => {
      // Codacy's detect-unhandled-async-errors caught this one: eviction runs
      // inside respondWith, so a rejection here would have broken the very
      // response it was tidying up after.
      const cache = makeCache({
        keys: vi.fn(async () => {
          throw new DOMException('cache invalidated', 'InvalidStateError')
        }),
      })
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        async () => ok('weights'),
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/model.onnx'),
      )

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('weights')
    })

    it('serves the model when a cached entry cannot be measured for eviction', async () => {
      const cached = new Request('https://huggingface.co/old.onnx')
      const cache = makeCache({
        keys: vi.fn(async () => [cached]),
        match: vi.fn(async () => {
          throw new DOMException('cache invalidated', 'InvalidStateError')
        }),
      })
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        async () => ok('weights'),
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/model.onnx'),
      )

      expect(response.status).toBe(200)
    })

    it('falls through to the network when the cache cannot be opened', async () => {
      const fetchImpl = vi.fn(async () => ok('fresh'))
      const worker = loadWorker(
        {
          open: vi.fn(async () => {
            throw new DOMException('storage blocked', 'SecurityError')
          }),
          match: vi.fn(async () => undefined),
        },
        fetchImpl,
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/model.onnx'),
      )

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('fresh')
      expect(fetchImpl).toHaveBeenCalledOnce()
    })
  })

  describe('a 503 still means the network failed', () => {
    it('returns 503 for a model asset that could not be fetched, and caches nothing', async () => {
      const cache = makeCache()
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        async () => {
          throw new TypeError('Failed to fetch')
        },
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/tokenizer_config.json'),
      )

      expect(response.status).toBe(503)
      // An error response must not become the cached copy, or a transient
      // outage would be pinned for the life of the cache.
      expect(cache.put).not.toHaveBeenCalled()
    })

    it('returns 503 for a navigation with no cached shell', async () => {
      const worker = loadWorker(
        {
          open: vi.fn(async () => makeCache()),
          match: vi.fn(async () => undefined),
        },
        async () => {
          throw new TypeError('Failed to fetch')
        },
      )

      const response = await worker.dispatchFetch(
        new Request('https://app.example.com/library', {
          headers: { accept: 'text/html' },
        }),
      )

      expect(response.status).toBe(503)
    })
  })

  describe('routing', () => {
    it('files model assets in the model cache, not the shell cache', async () => {
      const modelCache = makeCache()
      const staticCache = makeCache()
      const open = vi.fn(async (name: string) =>
        name === 'dks-model-v1' ? modelCache : staticCache,
      )
      const worker = loadWorker(
        { open, match: vi.fn(async () => undefined) },
        async () => ok('payload'),
      )

      await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/tokenizer.json'),
      )

      expect(open).toHaveBeenCalledWith('dks-model-v1')
      expect(modelCache.put).toHaveBeenCalledOnce()
      expect(staticCache.put).not.toHaveBeenCalled()
    })

    it('serves model assets from the cache without touching the network', async () => {
      const cachedResponse = ok('cached weights')
      const fetchImpl = vi.fn(async () => ok('network weights'))
      const worker = loadWorker(
        {
          open: vi.fn(async () => makeCache({ match: vi.fn(async () => cachedResponse) })),
          match: vi.fn(async () => undefined),
        },
        fetchImpl,
      )

      const response = await worker.dispatchFetch(
        new Request('https://huggingface.co/Xenova/model/resolve/main/model.onnx'),
      )

      expect(await response.text()).toBe('cached weights')
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('routes same-origin static assets to the shell cache', async () => {
      const staticCache = makeCache()
      const open = vi.fn(async () => staticCache)
      const worker = loadWorker(
        { open, match: vi.fn(async () => undefined) },
        async () => ok('body', 'text/css'),
      )

      await worker.dispatchFetch(new Request('https://app.example.com/styles.css'))

      expect(open).toHaveBeenCalledWith('dks-static-v6')
      expect(staticCache.put).toHaveBeenCalledOnce()
    })

    it('passes non-GET requests straight to the network without caching', async () => {
      const open = vi.fn(async () => makeCache())
      const worker = loadWorker(
        { open, match: vi.fn(async () => undefined) },
        async () => ok('{"ok":true}'),
      )

      const response = await worker.dispatchFetch(
        new Request('https://app.example.com/api', { method: 'POST', body: '{}' }),
      )

      expect(response.status).toBe(200)
      expect(open).not.toHaveBeenCalled()
    })
  })

  describe('install', () => {
    it('precaches the manifest URLs and activates immediately', async () => {
      const cache = makeCache()
      const fetchImpl = vi.fn(async () =>
        ok(JSON.stringify({ urls: ['/', '/app.js'] }), 'application/json'),
      )
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        fetchImpl,
      )

      await worker.dispatchInstall()

      expect(fetchImpl).toHaveBeenCalledOnce()
      expect(cache.add).toHaveBeenCalledTimes(2)
      expect(worker.self.skipWaiting).toHaveBeenCalledOnce()
    })

    it('falls back to the shell list when the manifest cannot be fetched', async () => {
      const cache = makeCache()
      const worker = loadWorker(
        { open: vi.fn(async () => cache), match: vi.fn(async () => undefined) },
        async () => {
          throw new TypeError('Failed to fetch')
        },
      )

      await worker.dispatchInstall()

      // Four fallback shell URLs, not zero: a partial shell still beats none.
      expect(cache.add).toHaveBeenCalledTimes(4)
      expect(worker.self.skipWaiting).toHaveBeenCalledOnce()
    })
  })
})
