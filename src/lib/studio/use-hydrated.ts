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
    let unsub: (() => void) | undefined
    const persist = useStudioStore.persist
    if (persist?.onFinishHydration) {
      unsub = persist.onFinishHydration(() => {
        setHydrated(true)
      })
      setHydrated(Boolean(persist.hasHydrated()))
    }
    return () => {
      if (unsub) {
        unsub()
      }
    }
  }, [])

  return hydrated
}
