import { afterEach, beforeEach, vi } from 'vitest'
import { useStudioStore } from './store'
import { resetSearchCache } from '@/lib/search/retrieval'
import { resetStore } from './test-helpers'

export const RECOVERY_KEY = 'do-knowledge-studio-recovery'
export const STORE_KEY = 'do-knowledge-studio-store'
const originalPersistStorage = useStudioStore.persist.getOptions().storage
export const usePersistStorageFailure = (failures: number, thrown: unknown): void => {
  let calls = 0
  useStudioStore.persist.setOptions({
    storage: {
      getItem: () => null,
      setItem: (name: string) => {
        if (name === STORE_KEY) {
          calls += 1
          if (calls <= failures) throw thrown
        }
      },
      removeItem: () => undefined,
    },
  })
}

export const stubLocalStorage = (overrides: {
  getItem?: (key: string) => string | null
  setItem?: (key: string, value: string) => void
  removeItem?: (key: string) => void
}): void => {
  vi.stubGlobal('localStorage', {
    getItem: overrides.getItem ?? (() => null),
    setItem: overrides.setItem ?? (() => undefined),
    removeItem: overrides.removeItem ?? (() => undefined),
  })
}

export const installStoreCoverageHooks = (): void => {
  beforeEach(() => {
    resetStore({
      entities: [],
      claims: [],
      chat: [],
      entityHistory: [{ entities: [], claims: [] }],
    })
    resetSearchCache()
    localStorage.removeItem(RECOVERY_KEY)
    vi.useFakeTimers()
  })

  afterEach(() => {
    useStudioStore.persist.setOptions({ storage: originalPersistStorage })
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
}
