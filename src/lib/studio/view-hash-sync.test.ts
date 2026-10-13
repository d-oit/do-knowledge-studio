import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudioStore } from './store'
import { startViewHashSync } from './view-hash-sync'

let stopSync = (): void => {}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  useStudioStore.setState({ currentView: 'library' })
  stopSync = startViewHashSync()
})

afterEach(() => {
  stopSync()
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('view hash synchronization', () => {
  it('gives a deep-link hash precedence over the persisted view on startup', () => {
    stopSync()
    useStudioStore.setState({ currentView: 'library' })
    window.history.replaceState(null, '', '/#/graph')
    stopSync = startViewHashSync()

    expect(useStudioStore.getState().currentView).toBe('graph')
  })

  it('preserves the persisted view when the hash is empty', () => {
    expect(useStudioStore.getState().currentView).toBe('library')
  })

  it('pushes a history entry when the store navigates to another view', () => {
    const previousLength = window.history.length

    useStudioStore.getState().setView('mindmap')

    expect(window.location.hash).toBe('#/mindmap')
    expect(window.history.length).toBe(previousLength + 1)
  })

  it('applies Back/Forward hash events without adding another history entry', () => {
    window.history.pushState(null, '', '/#/export')
    const historyLength = window.history.length
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(useStudioStore.getState().currentView).toBe('export')
    expect(window.history.length).toBe(historyLength)
  })

  it('applies direct hash changes', () => {
    window.history.pushState(null, '', '/#/timeline')
    const historyLength = window.history.length
    window.dispatchEvent(new Event('hashchange'))

    expect(useStudioStore.getState().currentView).toBe('timeline')
    expect(window.history.length).toBe(historyLength)
  })

  it('ignores skip-link anchors instead of treating them as views', () => {
    window.history.pushState(null, '', '/#main-content')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(useStudioStore.getState().currentView).toBe('library')
    expect(window.location.hash).toBe('#main-content')
  })

  it('reapplies the deep link after persistence finishes hydration', () => {
    stopSync()
    window.history.replaceState(null, '', '/#/graph')
    useStudioStore.setState({ currentView: 'library' })
    const finishHydration: { current: (() => void) | null } = { current: null }
    const hasHydrated = vi.spyOn(useStudioStore.persist, 'hasHydrated').mockReturnValue(false)
    vi.spyOn(useStudioStore.persist, 'onFinishHydration').mockImplementation((listener) => {
      finishHydration.current = () => listener(useStudioStore.getState())
      return () => {
        finishHydration.current = null
      }
    })
    stopSync = startViewHashSync()

    useStudioStore.setState({ currentView: 'library' })
    expect(window.location.hash).toBe('#/graph')

    hasHydrated.mockReturnValue(true)
    finishHydration.current?.()

    expect(useStudioStore.getState().currentView).toBe('graph')
    expect(window.location.hash).toBe('#/graph')
  })

  it('does not write the view hash while hydration refusal is active', async () => {
    stopSync()
    vi.resetModules()
    const [{ startViewHashSync: startFreshSync }, { recordHydrationRefusal }, { useStudioStore: freshStore }] =
      await Promise.all([import('./view-hash-sync'), import('./hydration-guard'), import('./store')])
    await freshStore.persist.rehydrate()
    expect(freshStore.persist.hasHydrated()).toBe(true)

    window.history.replaceState(null, '', '/#/graph')
    recordHydrationRefusal('rejected payload', null, false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stopSync = startFreshSync()
    freshStore.getState().setView('mindmap')

    expect(freshStore.getState().currentView).toBe('mindmap')
    expect(window.location.hash).toBe('#/graph')
    expect(warn).toHaveBeenCalled()
  })
})
