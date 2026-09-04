import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import type { SyncDoc } from './types'

/** IndexedDB database name for Yjs persistence. */
const DB_NAME = 'dks-sync'
/** Prefix for WebRTC room names. */
const ROOM_PREFIX = 'dks-room'

let currentDoc: Y.Doc | null = null
let currentSync: SyncDoc | null = null
let currentPersistence: IndexeddbPersistence | null = null
let currentProvider: WebrtcProvider | null = null

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

/** Initialize IndexedDB persistence for the Yjs document. */
export const initPersistence = async (): Promise<void> => {
  if (currentPersistence) return
  const doc = getDoc()
  currentPersistence = new IndexeddbPersistence(DB_NAME, doc)
  await currentPersistence.whenSynced
}

/** Join a WebRTC signaling room for peer-to-peer sync. */
export const joinRoom = (
  roomId: string,
  opts?: { signaling?: string[]; password?: string },
): WebrtcProvider => {
  if (currentProvider) {
    currentProvider.destroy()
  }
  const doc = getDoc()
  const signaling = opts?.signaling ?? [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling.herokuapp.com',
  ]
  currentProvider = new WebrtcProvider(`${ROOM_PREFIX}-${roomId}`, doc, {
    signaling,
    password: opts?.password,
  })
  return currentProvider
}

/** Get the active WebRTC provider or null. */
export const getProvider = (): WebrtcProvider | null => {
  return currentProvider
}

/** Get the awareness instance from the active provider, or null. */
export const getAwareness = (): WebrtcProvider['awareness'] | null => {
  return currentProvider?.awareness ?? null
}

/** Destroy the provider, persistence, and Yjs document, cleaning up all resources. */
export const destroy = (): void => {
  currentProvider?.destroy()
  currentProvider = null
  currentPersistence?.destroy()
  currentPersistence = null
  currentDoc?.destroy()
  currentDoc = null
  currentSync = null
}
