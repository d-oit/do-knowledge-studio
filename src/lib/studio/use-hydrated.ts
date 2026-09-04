'use client'

import { useEffect, useState } from 'react'
import { useStudioStore } from './store'

/**
 * Returns whether the Zustand store has finished rehydrating persisted state
 * from storage (e.g. localStorage).
 */
export const useStoreHydrated = (): boolean => {
  const [hydrated, setHydrated] = useState<boolean>(() =>
    Boolean(useStudioStore.persist?.hasHydrated ? useStudioStore.persist.hasHydrated() : true),
  )

  useEffect(() => {
    if (!useStudioStore.persist?.onFinishHydration) return
    const unsub = useStudioStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    setHydrated(Boolean(useStudioStore.persist.hasHydrated()))
    return () => {
      unsub()
    }
  }, [])

  return hydrated
}
