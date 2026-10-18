import { getAwareness } from './doc'
import type { SyncAwareness } from './doc'
import { getDeviceId, getDeviceName } from './discovery'
import { PRESENCE_COLORS } from './presence'

/** 2D cursor position on the canvas. */
export interface CursorPosition {
  x: number
  y: number
}

/** Text selection range broadcast by a remote peer. */
export interface SelectionRange {
  start: number
  end: number
  text: string
}

/** Remote peer cursor state including position, selection, and metadata. */
export interface RemoteCursor {
  deviceId: string
  name: string
  color: string
  position: CursorPosition | null
  selection: SelectionRange | null
  currentView: string
  lastUpdate: number
}

let colorIndex = 0

function getNextColor(): string {
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length]
  colorIndex++
  return color
}

const LOCAL_COLOR = getNextColor()

/** Broadcast the local cursor position to remote peers. */
export function setCursorPosition(x: number, y: number): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    deviceId: getDeviceId(),
    name: getDeviceName(),
    color: LOCAL_COLOR,
    position: { x, y },
    selection: null,
    currentView: awareness.getLocalState()?.presence?.currentView ?? 'home',
    lastUpdate: Date.now(),
  })
}

/** Clear the local cursor position from the awareness state. */
export function clearCursorPosition(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    position: null,
    lastUpdate: Date.now(),
  })
}

/** Broadcast the local text selection to remote peers. */
export function setSelection(start: number, end: number, text: string): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    selection: { start, end, text: text.slice(0, 100) },
    lastUpdate: Date.now(),
  })
}

/** Clear the local text selection from the awareness state. */
export function clearSelection(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    selection: null,
    lastUpdate: Date.now(),
  })
}

/** Read the local cursor state from the awareness protocol. */
export function getLocalCursor(): RemoteCursor | null {
  const awareness = getAwareness()
  if (!awareness) return null

  const state = awareness.getLocalState()
  return (state?.cursor as RemoteCursor) ?? null
}

/** Get all remote cursors excluding the local device. */
export function getRemoteCursors(): RemoteCursor[] {
  const awareness = getAwareness()
  if (!awareness) return []

  const cursors: RemoteCursor[] = []
  const states = awareness.getStates()

  states.forEach((state, clientId) => {
    if (clientId === awareness.clientID) return
    const cursor = state?.cursor as RemoteCursor | undefined
    if (cursor && cursor.deviceId !== getDeviceId()) {
      cursors.push(cursor)
    }
  })

  return cursors
}

/** Get remote cursors visible on a specific view. */
export function getCursorsForView(view: string): RemoteCursor[] {
  return getRemoteCursors().filter((c) => c.currentView === view)
}

type CursorCallback = (cursors: RemoteCursor[]) => void

const cursorCallbacks = new Set<CursorCallback>()
let boundAwareness: SyncAwareness | null = null
const dispatchCursorChange = () => {
  const cursors = getRemoteCursors()
  for (const callback of cursorCallbacks) callback(cursors)
}

/** Rebind the singleton dispatcher when the collaboration room changes. */
export function bindCursorAwareness(): void {
  const awareness = getAwareness()
  if (boundAwareness === awareness) return
  boundAwareness?.off('change', dispatchCursorChange)
  boundAwareness = awareness
  boundAwareness?.on('change', dispatchCursorChange)
}

/** Detach the room listener while retaining subscribers for a later rejoin. */
export function unbindCursorAwareness(): void {
  boundAwareness?.off('change', dispatchCursorChange)
  boundAwareness = null
}

/** Subscribe to changes in remote cursor positions. */
export function onCursorChange(callback: CursorCallback): () => void {
  cursorCallbacks.add(callback)
  bindCursorAwareness()
  return () => {
    cursorCallbacks.delete(callback)
    if (cursorCallbacks.size === 0) unbindCursorAwareness()
  }
}
