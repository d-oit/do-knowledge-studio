'use client'

import { useEffect, useState } from 'react'
import { loadIceServerSettings } from '@/lib/sync/ice-settings'
import type { IceServerConfig } from '@/lib/sync/ice-config'

/**
 * Loads the ICE servers a room join should use (#1052).
 *
 * Extracted from `sync-view.tsx` to keep that view under the 500 LOC limit. The
 * list is held in component state only: credentials are already encrypted at
 * rest by `ice-settings.ts`, and nothing here persists them again.
 */
export const useSyncIceServers = (): readonly [
  IceServerConfig[],
  (servers: IceServerConfig[]) => void,
] => {
  const [iceServers, setIceServers] = useState<IceServerConfig[]>([])

  useEffect(() => {
    let cancelled = false
    void loadIceServerSettings().then((servers) => {
      // An unchanged (usually empty) list keeps the previous reference, so the
      // effect does not force a re-render on mount.
      if (!cancelled) {
        setIceServers((previous) => (servers.length === 0 && previous.length === 0 ? previous : servers))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return [iceServers, setIceServers] as const
}
