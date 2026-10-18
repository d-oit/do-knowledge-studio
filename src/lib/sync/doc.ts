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
export const joinRoom = (
  roomId: string,
  opts?: { signaling?: string[]; password?: string },
): RoomProvider => {
  if (currentProvider) {
    currentProvider.destroy()
  }
  currentRoomId = roomId
  lastRoomId = roomId
  if (currentPersistence) {
    void currentPersistence.set(LAST_ROOM_ID_KEY, roomId).catch((error: unknown) => {
      console.error('Failed to persist local sync room metadata', error)
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
  return currentProvider
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
  currentProvider?.destroy()
  currentProvider = null
  currentRoomId = null
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
