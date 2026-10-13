import type { StudioState } from './store-types'
import { getHydrationRefusal } from './hydration-guard'
import { useStudioStore } from './store'
import { isKnownViewHash, parseViewHash, viewToHash } from './view-hash'

/** Synchronizes view state and browser history for the lifetime of the AppShell. */
export const startViewHashSync = (): (() => void) => {
  const persist = useStudioStore.persist

  const applyHash = (): void => {
    const hash = window.location.hash
    const view = parseViewHash(hash)
    if (view === null) return

    if (!isKnownViewHash(hash)) {
      window.history.replaceState(null, '', viewToHash(view))
    }

    const state = useStudioStore.getState()
    if (state.currentView !== view) state.setView(view)
  }

  const handleStoreChange = (state: StudioState, previousState: StudioState): void => {
    if (getHydrationRefusal() !== null || !persist.hasHydrated()) return
    if (state.currentView === previousState.currentView) return

    const nextHash = viewToHash(state.currentView)
    if (window.location.hash === nextHash) return

    window.history.pushState(null, '', nextHash)
  }

  window.addEventListener('popstate', applyHash)
  window.addEventListener('hashchange', applyHash)
  const unsubscribeStore = useStudioStore.subscribe(handleStoreChange)
  const unsubscribeHydration = persist.onFinishHydration(applyHash)

  applyHash()

  return () => {
    window.removeEventListener('popstate', applyHash)
    window.removeEventListener('hashchange', applyHash)
    unsubscribeStore()
    unsubscribeHydration()
  }
}
