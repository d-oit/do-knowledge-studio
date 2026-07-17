'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  onPresenceChange,
  setLocalPresence,
  getLocalPresence,
  updateCurrentView,
  type UserPresence,
} from './presence'
import { getDeviceName } from './discovery'

export type { UserPresence }

export interface UsePresenceReturn {
  peers: UserPresence[]
  peerCount: number
  localPresence: UserPresence | null
  setPresence: (partial: Partial<Omit<UserPresence, 'deviceId' | 'color'>>) => void
  setCurrentView: (view: string) => void
}

export function usePresence(): UsePresenceReturn {
  const [peers, setPeers] = useState<UserPresence[]>([])
  const [peerCount, setPeerCountState] = useState(1)

  useEffect(() => {
    setLocalPresence({
      name: getDeviceName(),
      currentView: 'home',
    })

    const unsub = onPresenceChange((remotePeers) => {
      setPeers(remotePeers)
      setPeerCountState(remotePeers.length + 1)
    })

    return unsub
  }, [])

  const setPresence = useCallback(
    (partial: Partial<Omit<UserPresence, 'deviceId' | 'color'>>) => {
      setLocalPresence(partial)
    },
    [],
  )

  const setCurrentView = useCallback((view: string) => {
    updateCurrentView(view)
  }, [])

  return {
    peers,
    peerCount,
    localPresence: getLocalPresence(),
    setPresence,
    setCurrentView,
  }
}
