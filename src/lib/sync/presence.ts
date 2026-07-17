import { getAwareness } from './doc'
import { getDeviceId, getDeviceName } from './discovery'

export interface UserPresence {
  deviceId: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  currentView: string
  lastActive: number
}

const PRESENCE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9',
]

let colorIndex = 0

function getNextColor(): string {
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length]
  colorIndex++
  return color
}

const LOCAL_COLOR = getNextColor()

export function setLocalPresence(partial: Partial<Omit<UserPresence, 'deviceId' | 'color'>>): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    deviceId: getDeviceId(),
    name: getDeviceName(),
    color: LOCAL_COLOR,
    cursor: null,
    currentView: 'home',
    lastActive: Date.now(),
    ...partial,
  })
}

export function updateCursor(x: number, y: number): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    cursor: { x, y },
    lastActive: Date.now(),
  })
}

export function updateCurrentView(view: string): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    currentView: view,
    lastActive: Date.now(),
  })
}

export function getLocalPresence(): UserPresence | null {
  const awareness = getAwareness()
  if (!awareness) return null

  const state = awareness.getLocalState()
  return (state?.presence as UserPresence) ?? null
}

export function getRemotePeers(): UserPresence[] {
  const awareness = getAwareness()
  if (!awareness) return []

  const peers: UserPresence[] = []
  const states = awareness.getStates()

  states.forEach((state, clientId) => {
    if (clientId === awareness.clientID) return
    const presence = state?.presence as UserPresence | undefined
    if (presence && presence.deviceId !== getDeviceId()) {
      peers.push(presence)
    }
  })

  return peers
}

export function getPeerCount(): number {
  return getRemotePeers().length + 1
}

type PresenceCallback = (peers: UserPresence[]) => void

let presenceCallbacks: PresenceCallback[] = []

export function onPresenceChange(callback: PresenceCallback): () => void {
  presenceCallbacks.push(callback)

  const awareness = getAwareness()
  if (awareness) {
    const handler = () => {
      const peers = getRemotePeers()
      for (const cb of presenceCallbacks) {
        cb(peers)
      }
    }
    awareness.on('change', handler)
    return () => {
      awareness.off('change', handler)
      presenceCallbacks = presenceCallbacks.filter((cb) => cb !== callback)
    }
  }

  return () => {
    presenceCallbacks = presenceCallbacks.filter((cb) => cb !== callback)
  }
}

export function broadcastPresence(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    lastActive: Date.now(),
  })
}
