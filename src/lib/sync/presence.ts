import { getAwareness } from './doc'
import { getDeviceId, getDeviceName } from './discovery'

/** Presence state broadcast by a connected peer. */
export interface UserPresence {
  deviceId: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  currentView: string
  lastActive: number
}

/** Pool of colors assigned to connected peers. */
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

/** Set the local peer's presence state on the awareness protocol. */
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

/** Broadcast the local cursor position to remote peers. */
export function updateCursor(x: number, y: number): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    cursor: { x, y },
    lastActive: Date.now(),
  })
}

/** Broadcast the local peer's current view to remote peers. */
export function updateCurrentView(view: string): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    currentView: view,
    lastActive: Date.now(),
  })
}

/** Read the local peer's presence state from the awareness protocol. */
export function getLocalPresence(): UserPresence | null {
  const awareness = getAwareness()
  if (!awareness) return null

  const state = awareness.getLocalState()
  return (state?.presence as UserPresence) ?? null
}

/** Get all remote peers' presence states excluding the local device. */
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

/** Return total peer count including the local device. */
export function getPeerCount(): number {
  return getRemotePeers().length + 1
}

type PresenceCallback = (peers: UserPresence[]) => void

let presenceCallbacks: PresenceCallback[] = []

/** Subscribe to changes in remote peer presence. */
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

/** Broadcast the local presence state to trigger peer updates. */
export function broadcastPresence(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('presence', {
    ...getLocalPresence(),
    lastActive: Date.now(),
  })
}
