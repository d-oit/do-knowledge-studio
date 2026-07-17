import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import type { SyncDoc } from './types'

const DB_NAME = 'dks-sync'
const ROOM_PREFIX = 'dks-room'

let currentDoc: Y.Doc | null = null
let currentSync: SyncDoc | null = null
let currentPersistence: IndexeddbPersistence | null = null
let currentProvider: WebrtcProvider | null = null

export function getDoc(): Y.Doc {
  if (!currentDoc) {
    currentDoc = new Y.Doc()
  }
  return currentDoc
}

export function getSyncDoc(): SyncDoc {
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

export async function initPersistence(): Promise<void> {
  if (currentPersistence) return
  const doc = getDoc()
  currentPersistence = new IndexeddbPersistence(DB_NAME, doc)
  await currentPersistence.whenSynced
}

export function joinRoom(
  roomId: string,
  opts?: { signaling?: string[] },
): WebrtcProvider {
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
  })
  return currentProvider
}

export function getProvider(): WebrtcProvider | null {
  return currentProvider
}

export function getAwareness(): WebrtcProvider['awareness'] | null {
  return currentProvider?.awareness ?? null
}

export function destroy(): void {
  currentProvider?.destroy()
  currentProvider = null
  currentPersistence?.destroy()
  currentPersistence = null
  currentDoc?.destroy()
  currentDoc = null
  currentSync = null
}
