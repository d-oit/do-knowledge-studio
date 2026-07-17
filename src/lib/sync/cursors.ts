import { getAwareness } from './doc'
import { getDeviceId, getDeviceName } from './discovery'

export interface CursorPosition {
  x: number
  y: number
}

export interface SelectionRange {
  start: number
  end: number
  text: string
}

export interface RemoteCursor {
  deviceId: string
  name: string
  color: string
  position: CursorPosition | null
  selection: SelectionRange | null
  currentView: string
  lastUpdate: number
}

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

export function clearCursorPosition(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    position: null,
    lastUpdate: Date.now(),
  })
}

export function setSelection(start: number, end: number, text: string): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    selection: { start, end, text: text.slice(0, 100) },
    lastUpdate: Date.now(),
  })
}

export function clearSelection(): void {
  const awareness = getAwareness()
  if (!awareness) return

  awareness.setLocalStateField('cursor', {
    ...getLocalCursor(),
    selection: null,
    lastUpdate: Date.now(),
  })
}

export function getLocalCursor(): RemoteCursor | null {
  const awareness = getAwareness()
  if (!awareness) return null

  const state = awareness.getLocalState()
  return (state?.cursor as RemoteCursor) ?? null
}

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

export function getCursorsForView(view: string): RemoteCursor[] {
  return getRemoteCursors().filter((c) => c.currentView === view)
}

type CursorCallback = (cursors: RemoteCursor[]) => void

let cursorCallbacks: CursorCallback[] = []

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
