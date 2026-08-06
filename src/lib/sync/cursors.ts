import { getAwareness } from './doc'
import { getDeviceId, getDeviceName } from './discovery'

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

/** Color palette for cursor indicators. */
const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

let colorIndex = 0

function getNextColor(): string {
  const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length]
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

let cursorCallbacks: CursorCallback[] = []

/** Subscribe to changes in remote cursor positions. */
export function onCursorChange(callback: CursorCallback): () => void {
  cursorCallbacks.push(callback)

  const awareness = getAwareness()
  if (awareness) {
    const handler = () => {
      const cursors = getRemoteCursors()
      for (const cb of cursorCallbacks) {
        cb(cursors)
      }
    }
    awareness.on('change', handler)
    return () => {
      awareness.off('change', handler)
      cursorCallbacks = cursorCallbacks.filter((cb) => cb !== callback)
    }
  }

  return () => {
    cursorCallbacks = cursorCallbacks.filter((cb) => cb !== callback)
  }
}
