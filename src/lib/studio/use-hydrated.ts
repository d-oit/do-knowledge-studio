'use client'

import { useEffect, useState } from 'react'
import { useStudioStore } from './store'

/**
 * Returns whether the Zustand store has finished rehydrating persisted state
 * from storage (e.g. localStorage).
 */
export const useStoreHydrated = (): boolean => {
  const [hydrated, setHydrated] = useState<boolean>(() => useStudioStore.persist.hasHydrated())

  useEffect(() => {
    const unsub = useStudioStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    setHydrated(useStudioStore.persist.hasHydrated())
    return () => {
      unsub()
    }
  }, [])

  return hydrated
}
