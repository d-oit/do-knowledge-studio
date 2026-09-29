import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import { ServiceWorkerRegistration } from './service-worker-registration'

/** Handle returned by every stubbed `update()` call. */
const RESOLVED_UPDATE = Promise.resolve(undefined)

/** Records every registration/update call for assertions. */
interface ServiceWorkerStub {
  register: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  listeners: Map<string, Set<(event: Event) => void>>
  ready: Promise<unknown>
  emit: (type: string) => void
}

/** Installs a controllable `navigator.serviceWorker` on the jsdom window. */
const installServiceWorker = (
  options: {
    updateRejects?: boolean
    /** Supplies a worker mid-install so the update lifecycle can be driven. */
    installing?: unknown
    /** Whether a previous worker is already controlling the page. */
    controlled?: boolean
  } = {},
): ServiceWorkerStub => {
  const listeners = new Map<string, Set<(event: Event) => void>>()
  const update = vi.fn(() =>
    options.updateRejects
      ? Promise.reject(new Error('update failed'))
      : RESOLVED_UPDATE,
  )
  const registration = {
    update,
    installing: options.installing ?? null,
    addEventListener: vi.fn((type: string, handler: (event: Event) => void) => {
      const set = listeners.get(type) ?? new Set()
      set.add(handler)
      listeners.set(type, set)
    }),
  }
  const ready = Promise.resolve(registration)
  const register = vi.fn(() => Promise.resolve(registration))

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register,
      ready,
      controller: options.controlled ? {} : null,
    },
  })

  return {
    register,
    update,
    listeners,
    ready,
    emit: (type: string) => {
      for (const handler of listeners.get(type) ?? []) {
        handler(new Event(type))
      }
    },
  }
}

/** Removes the `serviceWorker` property so the next test starts clean. */
const removeServiceWorker = () => {
  // @ts-expect-error -- deleting an injected test global is intentional here.
  delete window.navigator.serviceWorker
}

/** Drives a `visibilitychange` to the given state. */
const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('ServiceWorkerRegistration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    cleanup()
    removeServiceWorker()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('registers with a root scope and no HTTP-cache indirection', async () => {
    const sw = installServiceWorker()
    render(<ServiceWorkerRegistration />)

    await waitFor(() => {
      expect(sw.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
    })
  })

  it('renders nothing — it is a side-effect mount only', () => {
    installServiceWorker()
    const { container } = render(<ServiceWorkerRegistration />)
    expect(container.innerHTML).toBe('')
  })

  it('does nothing when the browser has no service worker support', () => {
    removeServiceWorker()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => { render(<ServiceWorkerRegistration />) }).not.toThrow()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('does not register when the browser has no service worker support', () => {
    const { register } = installServiceWorker()
    removeServiceWorker()
    render(<ServiceWorkerRegistration />)
    expect(register).not.toHaveBeenCalled()
  })

  it('checks for a new worker once the registration resolves', async () => {
    const sw = installServiceWorker()
    render(<ServiceWorkerRegistration />)

    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(1) })
  })

  it('re-checks for updates on a periodic interval', async () => {
    const sw = installServiceWorker()
    render(<ServiceWorkerRegistration />)
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(1) })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    })
    expect(sw.update).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    })
    expect(sw.update).toHaveBeenCalledTimes(3)
  })

  it('re-checks when the tab becomes visible again', async () => {
    const sw = installServiceWorker()
    render(<ServiceWorkerRegistration />)
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(1) })

    act(() => { setVisibility('hidden') })
    expect(sw.update).toHaveBeenCalledTimes(1)

    await act(async () => { setVisibility('visible') })
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(2) })
  })

  it('re-checks when the browser comes back online', async () => {
    const sw = installServiceWorker()
    render(<ServiceWorkerRegistration />)
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(1) })

    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(2) })
  })

  it('stops the interval and the listeners on unmount', async () => {
    const sw = installServiceWorker()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<ServiceWorkerRegistration />)
    await waitFor(() => { expect(sw.update).toHaveBeenCalledTimes(1) })

    unmount()
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(windowRemoveSpy).toHaveBeenCalledWith('online', expect.any(Function))

    const callsAfterUnmount = sw.update.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 * 3)
      window.dispatchEvent(new Event('online'))
      setVisibility('visible')
    })
    // Nothing schedules work after teardown.
    expect(sw.update).toHaveBeenCalledTimes(callsAfterUnmount)
  })

  it('logs but does not throw when an update check rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sw = installServiceWorker({ updateRejects: true })
    render(<ServiceWorkerRegistration />)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Service worker update check failed:',
        expect.any(Error),
      )
    })
    expect(sw.register).toHaveBeenCalled()
  })

  it('never touches the cache or the worker lifecycle from the page', async () => {
    // Regression guard for plans/158 P0-2. The component used to subscribe to
    // `updatefound` and, on the new worker reaching `installed`, deleted every
    // cache starting with `dks-`. The new worker's own caches are named
    // `dks-*`, so that removed the precache it had just written and took the
    // offline shell with it on every deploy. Cache lifecycle belongs to
    // sw.js's `activate` handler, which allowlists the current caches.
    const deleted: string[] = []
    // jsdom ships no CacheStorage; install a spy-able one so the assertions
    // are about whether the page touches the cache at all.
    const cacheStorage = {
      keys: vi.fn(() => Promise.resolve(['dks-static-v2', 'dks-api-v2'])),
      delete: vi.fn((name: string | Request) => {
        deleted.push(String(name))
        return Promise.resolve(true)
      }),
      open: vi.fn(),
      match: vi.fn(),
    }
    vi.stubGlobal('caches', cacheStorage)

    // A worker is mid-install, and a previous one is already controlling —
    // exactly the conditions under which the old code purged the cache.
    const stateHandlers: ((e: Event) => void)[] = []
    const installing = {
      state: 'installing',
      addEventListener: vi.fn((_type: string, handler: (e: Event) => void) => {
        stateHandlers.push(handler)
      }),
    }
    const sw = installServiceWorker({ installing, controlled: true })

    render(<ServiceWorkerRegistration />)
    await waitFor(() => { expect(sw.update).toHaveBeenCalled() })

    // The page must not subscribe to the worker lifecycle at all; if it did,
    // replaying the transition below would be the only way to reach a purge.
    expect(sw.listeners.get('updatefound')?.size ?? 0).toBe(0)
    expect(installing.addEventListener).not.toHaveBeenCalled()

    // Replay the full transition anyway: nothing may reach the cache.
    installing.state = 'installed'
    await act(async () => {
      stateHandlers.forEach((h) => { h(new Event('statechange')) })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(cacheStorage.keys).not.toHaveBeenCalled()
    expect(cacheStorage.delete).not.toHaveBeenCalled()
    expect(deleted).toEqual([])
  })

  it('logs but does not throw when registration itself fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const register = vi.fn(() => Promise.reject(new Error('no scope')))
    const registration = { update: vi.fn(), installing: null, addEventListener: vi.fn() }
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register, ready: Promise.resolve(registration) },
    })

    render(<ServiceWorkerRegistration />)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Service worker registration failed:',
        expect.any(Error),
      )
    })
  })
})
