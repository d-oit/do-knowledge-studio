import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockAwareness = {
  clientID: 1,
  setLocalStateField: vi.fn(),
  getLocalState: vi.fn(() => null),
  getStates: vi.fn(() => new Map()),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('./doc', () => ({
  getAwareness: vi.fn(() => mockAwareness),
}))

vi.mock('./discovery', () => ({
  getDeviceId: vi.fn(() => 'local-device'),
  getDeviceName: vi.fn(() => 'Local Device'),
}))

import {
  setCursorPosition,
  clearCursorPosition,
  setSelection,
  clearSelection,
  getLocalCursor,
  getRemoteCursors,
  getCursorsForView,
  onCursorChange,
} from './cursors'
import { getAwareness } from './doc'
import type { RemoteCursor } from './cursors'

function resetAwareness(): void {
  mockAwareness.clientID = 1
  mockAwareness.setLocalStateField.mockReset()
  mockAwareness.getLocalState.mockReset().mockReturnValue(null)
  mockAwareness.getStates.mockReset().mockReturnValue(new Map())
  mockAwareness.on.mockReset()
  mockAwareness.off.mockReset()
  vi.mocked(getAwareness).mockReturnValue(mockAwareness)
}

function makeCursor(overrides: Partial<RemoteCursor> = {}): RemoteCursor {
  return {
    deviceId: 'remote',
    name: 'Remote',
    color: '#3b82f6',
    position: null,
    selection: null,
    currentView: 'home',
    lastUpdate: 1000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(5000)
  resetAwareness()
})

afterEach(() => {
  vi.useRealTimers()
})

// --- setCursorPosition ---

describe('setCursorPosition', () => {
  it('sets cursor with device info and coordinates', () => {
    mockAwareness.getLocalState.mockReturnValue({
      presence: { currentView: 'editor' },
    })

    setCursorPosition(100, 200)

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', {
      deviceId: 'local-device',
      name: 'Local Device',
      color: expect.any(String),
      position: { x: 100, y: 200 },
      selection: null,
      currentView: 'editor',
      lastUpdate: 5000,
    })
  })

  it('falls back to home when no currentView in presence', () => {
    mockAwareness.getLocalState.mockReturnValue({})
    setCursorPosition(0, 0)

    const call = mockAwareness.setLocalStateField.mock.calls[0]
    expect((call[1] as { currentView: string }).currentView).toBe('home')
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    setCursorPosition(1, 2)
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- clearCursorPosition ---

describe('clearCursorPosition', () => {
  it('sets position to null and preserves other fields', () => {
    const existing = makeCursor({
      deviceId: 'local-device',
      position: { x: 5, y: 10 },
    })
    mockAwareness.getLocalState.mockReturnValue({ cursor: existing })

    clearCursorPosition()

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('cursor', {
      ...existing,
      position: null,
      lastUpdate: 5000,
    })
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    clearCursorPosition()
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- setSelection ---

describe('setSelection', () => {
  it('stores selection range', () => {
    mockAwareness.getLocalState.mockReturnValue({
      cursor: makeCursor({ deviceId: 'local-device' }),
    })

    setSelection(10, 20, 'selected text')

    const call = mockAwareness.setLocalStateField.mock.calls[0]
    const cursor = call[1] as { selection: { start: number; end: number; text: string } }
    expect(cursor.selection).toEqual({ start: 10, end: 20, text: 'selected text' })
  })

  it('truncates selection text to 100 chars', () => {
    mockAwareness.getLocalState.mockReturnValue({
      cursor: makeCursor({ deviceId: 'local-device' }),
    })

    const longText = 'a'.repeat(200)
    setSelection(0, 200, longText)

    const call = mockAwareness.setLocalStateField.mock.calls[0]
    const cursor = call[1] as { selection: { text: string } }
    expect(cursor.selection.text).toHaveLength(100)
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    setSelection(0, 5, 'text')
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- clearSelection ---

describe('clearSelection', () => {
  it('sets selection to null', () => {
    mockAwareness.getLocalState.mockReturnValue({
      cursor: makeCursor({
        deviceId: 'local-device',
        selection: { start: 0, end: 5, text: 'hello' },
      }),
    })

    clearSelection()

    const call = mockAwareness.setLocalStateField.mock.calls[0]
    const cursor = call[1] as { selection: unknown }
    expect(cursor.selection).toBeNull()
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    clearSelection()
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- getLocalCursor ---

describe('getLocalCursor', () => {
  it('returns cursor from local state', () => {
    const cursor = makeCursor({ deviceId: 'local-device' })
    mockAwareness.getLocalState.mockReturnValue({ cursor })

    expect(getLocalCursor()).toEqual(cursor)
  })

  it('returns null when no cursor in state', () => {
    mockAwareness.getLocalState.mockReturnValue({})
    expect(getLocalCursor()).toBeNull()
  })

  it('returns null when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    expect(getLocalCursor()).toBeNull()
  })
})

// --- getRemoteCursors ---

describe('getRemoteCursors', () => {
  it('filters out local client by clientID', () => {
    const states = new Map([
      [1, { cursor: makeCursor({ deviceId: 'local-device' }) }],
      [2, { cursor: makeCursor({ deviceId: 'remote-1', name: 'R1' }) }],
    ])
    mockAwareness.getStates.mockReturnValue(states)

    const cursors = getRemoteCursors()
    expect(cursors).toHaveLength(1)
    expect(cursors[0].deviceId).toBe('remote-1')
  })

  it('filters out entries with matching local deviceId', () => {
    const states = new Map([
      [5, { cursor: makeCursor({ deviceId: 'local-device' }) }],
      [6, { cursor: makeCursor({ deviceId: 'other', name: 'O' }) }],
    ])
    mockAwareness.getStates.mockReturnValue(states)
    mockAwareness.clientID = 99

    const cursors = getRemoteCursors()
    expect(cursors).toHaveLength(1)
    expect(cursors[0].deviceId).toBe('other')
  })

  it('skips entries without cursor field', () => {
    const states = new Map([
      [2, { presence: {} }],
      [3, { cursor: makeCursor({ deviceId: 'has-cursor' }) }],
    ])
    mockAwareness.getStates.mockReturnValue(states)

    expect(getRemoteCursors()).toHaveLength(1)
  })

  it('returns empty when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    expect(getRemoteCursors()).toEqual([])
  })
})

// --- getCursorsForView ---

describe('getCursorsForView', () => {
  it('filters remote cursors by currentView', () => {
    const states = new Map([
      [2, { cursor: makeCursor({ deviceId: 'a', currentView: 'editor' }) }],
      [3, { cursor: makeCursor({ deviceId: 'b', currentView: 'graph' }) }],
      [4, { cursor: makeCursor({ deviceId: 'c', currentView: 'editor' }) }],
    ])
    mockAwareness.getStates.mockReturnValue(states)

    const editorCursors = getCursorsForView('editor')
    expect(editorCursors).toHaveLength(2)
    expect(editorCursors.every((c) => c.currentView === 'editor')).toBe(true)
  })
})

// --- onCursorChange ---

describe('onCursorChange', () => {
  it('registers handler, invokes callback on change, and cleans up', () => {
    const cb = vi.fn()
    const unsub = onCursorChange(cb)

    expect(mockAwareness.on).toHaveBeenCalledWith('change', expect.any(Function))

    const handler = mockAwareness.on.mock.calls[0][1] as () => void
    handler()
    expect(cb).toHaveBeenCalled()

    unsub()
    expect(mockAwareness.off).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('returns cleanup-only when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    const cb = vi.fn()
    const unsub = onCursorChange(cb)

    unsub()
    expect(mockAwareness.on).not.toHaveBeenCalled()
  })
})
