import * as Y from 'yjs'
import { z } from 'zod'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import type { SyncDoc } from './types'
import { getSignalingServers, SIGNALING_SERVERS } from './discovery'
import { bindCursorAwareness, unbindCursorAwareness } from './cursors'
import { bindPresenceAwareness, unbindPresenceAwareness } from './presence'
/** WebRTC provider for an active collaboration room. */
export type RoomProvider = WebrtcProvider
/** Awareness protocol instance for the current provider. */
export type SyncAwareness = WebrtcProvider['awareness']

/** IndexedDB database name for Yjs persistence. */
const DB_NAME = 'dks-sync'
/** Prefix for WebRTC room names. */
const ROOM_PREFIX = 'dks-room'
/** Local-only IndexedDB metadata key used to restore tombstone scope offline. */
const LAST_ROOM_ID_KEY = 'lastJoinedRoomId'
/** Schema for local room identity recovered from the browser database. */
const ROOM_ID_SCHEMA = z.string().min(1)

let currentDoc: Y.Doc | null = null
let currentSync: SyncDoc | null = null
let currentPersistence: IndexeddbPersistence | null = null
let currentProvider: WebrtcProvider | null = null
let currentRoomId: string | null = null
let lastRoomId: string | null = null
let currentOpts: { signaling?: string[]; password?: string } | undefined
let connectivityListenersAttached = false

/**
 * Drop broken WebRTC peers when the browser goes offline and reconnect the
 * provider when it returns. Without this, y-webrtc keeps a dead `webrtcConns`
 * entry and ignores new announce messages, so edits made offline never reach
 * the peer after the network returns.
 */
const handleBrowserOffline = (): void => {
  currentProvider?.disconnect()
}

const handleBrowserOnline = (): void => {
  // A fresh provider gets a new peer id. Older y-webrtc peers can keep a dead
  // `webrtcConns` entry for the previous id, so merely calling connect() can
  // leave the room without a working data channel.
  if (currentRoomId !== null) {
    reconnectRoom()
  }
}

const attachConnectivityListeners = (): void => {
  if (connectivityListenersAttached || typeof window === 'undefined') return
  window.addEventListener('offline', handleBrowserOffline)
  window.addEventListener('online', handleBrowserOnline)
  connectivityListenersAttached = true
}

const detachConnectivityListeners = (): void => {
  if (!connectivityListenersAttached || typeof window === 'undefined') return
  window.removeEventListener('offline', handleBrowserOffline)
  window.removeEventListener('online', handleBrowserOnline)
  connectivityListenersAttached = false
}

/** Get or create the shared Yjs document. */
export const getDoc = (): Y.Doc => {
  if (!currentDoc) {
    currentDoc = new Y.Doc()
  }
  return currentDoc
}

/** Get or create the typed sync document view over the Yjs doc. */
export const getSyncDoc = (): SyncDoc => {
  if (!currentSync) {
    const doc = getDoc()
    currentSync = {
      entities: doc.getMap('entities'),
      claims: doc.getMap('claims'),
      meta: doc.getMap('meta'),
    }
  }
  return currentSync
}

/** Initialize IndexedDB persistence for the Yjs document and local room context. */
export const initPersistence = async (): Promise<void> => {
  if (!currentPersistence) {
    currentPersistence = new IndexeddbPersistence(DB_NAME, getDoc())
  }
  const persistence = currentPersistence
  await persistence.whenSynced

  let persistedRoomId: string | null = null
  try {
    const storedRoomId: unknown = await persistence.get(LAST_ROOM_ID_KEY)
    const parsedRoomId = ROOM_ID_SCHEMA.safeParse(storedRoomId)
    if (parsedRoomId.success) persistedRoomId = parsedRoomId.data
  } catch (error) {
    console.error('Failed to read local sync room metadata', error)
  }

  const roomId = currentRoomId ?? lastRoomId ?? persistedRoomId
  if (roomId === null) return
  lastRoomId = roomId
  if (roomId === persistedRoomId) return
  try {
    await persistence.set(LAST_ROOM_ID_KEY, roomId)
  } catch (error) {
    console.error('Failed to persist local sync room metadata', error)
  }
}

/** Join a WebRTC signaling room for peer-to-peer sync. */
const areRoomOptsEqual = (
  a?: { signaling?: string[]; password?: string },
  b?: { signaling?: string[]; password?: string },
): boolean => {
  if (a === b) return true
  const aSig = a?.signaling?.join(',') ?? ''
  const bSig = b?.signaling?.join(',') ?? ''
  const aPass = a?.password ?? ''
  const bPass = b?.password ?? ''
  return aSig === bSig && aPass === bPass
}

/** Check if IndexedDB persistence is initialized and synchronized. */
export const isPersistenceSynced = (): boolean => {
  return currentPersistence?.synced ?? false
}

/** Ensure persistence is initialized and fully synchronized. */
export const ensurePersistenceReady = async (): Promise<IndexeddbPersistence> => {
  if (!currentPersistence) {
    currentPersistence = new IndexeddbPersistence(DB_NAME, getDoc())
  }
  await currentPersistence.whenSynced
  return currentPersistence
}

/** Join a WebRTC signaling room for peer-to-peer sync. */
export const joinRoom = (
  roomId: string,
  opts?: { signaling?: string[]; password?: string },
): RoomProvider => {
  if (currentProvider && currentRoomId === roomId && areRoomOptsEqual(currentOpts, opts)) {
    return currentProvider
  }

  leaveRoom()

  currentRoomId = roomId
  lastRoomId = roomId
  currentOpts = opts ? { ...opts, signaling: opts.signaling ? [...opts.signaling] : undefined } : undefined

  if (currentPersistence) {
    void currentPersistence.set(LAST_ROOM_ID_KEY, roomId).catch((error: unknown) => {
      console.error('Failed to persist local sync room metadata', error)
    })
  } else {
    // If persistence wasn't initialized yet, initialize it in the background
    void initPersistence().catch((error: unknown) => {
      console.error('Failed to initialize persistence during joinRoom', error)
    })
  }

  const doc = getDoc()
  currentProvider = new WebrtcProvider(`${ROOM_PREFIX}-${roomId}`, doc, {
    signaling: opts?.signaling
      ? getSignalingServers(opts.signaling.join(','))
      : SIGNALING_SERVERS,
    password: opts?.password,
  })
  bindCursorAwareness()
  bindPresenceAwareness()
  attachConnectivityListeners()
  return currentProvider
}

/**
 * Recreate the provider for the current room with a fresh peer id.
 *
 * Used after browser connectivity returns and by the explicit Re-sync control
 * when the old provider is disconnected. The room id and password stay in
 * module memory only; neither is persisted or logged.
 */
export const reconnectRoom = (): RoomProvider | null => {
  const roomId = currentRoomId ?? lastRoomId
  if (roomId === null) return null
  const opts = currentOpts
  leaveRoom()
  return joinRoom(roomId, opts)
}

/** Get the active WebRTC provider or null. */
export const getProvider = (): WebrtcProvider | null => {
  return currentProvider
}

/** Active or last joined room identity for durable tombstones while offline. */
export const getCurrentRoomId = (): string | null => currentRoomId ?? lastRoomId

/** Get the awareness instance from the active provider, or null. */
export const getAwareness = (): WebrtcProvider['awareness'] | null => {
  return currentProvider?.awareness ?? null
}

/** Leave the room without destroying the shared document or IndexedDB persistence. */
export const leaveRoom = (): void => {
  unbindCursorAwareness()
  unbindPresenceAwareness()
  detachConnectivityListeners()
  if (currentProvider) {
    currentProvider.destroy()
    currentProvider = null
  }
  currentRoomId = null
  currentOpts = undefined
}
/**
 * Fully destroys the provider, IndexedDB persistence, and document. Product
 * room exits use `leaveRoom`; tests and refused-hydration/host teardown use this.
 */
export const destroy = (): void => {
  leaveRoom()
  currentPersistence?.destroy()
  currentPersistence = null
  currentDoc?.destroy()
  currentDoc = null
  currentSync = null
  lastRoomId = null
}
