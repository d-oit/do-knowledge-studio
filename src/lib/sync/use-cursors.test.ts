import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.fn()

vi.mock('./cursors', () => ({
  onCursorChange: vi.fn((cb: (cursors: never[]) => void) => {
    cursorCallback = cb
    return mockUnsubscribe
  }),
  setCursorPosition: vi.fn(),
  clearCursorPosition: vi.fn(),
  setSelection: vi.fn(),
  clearSelection: vi.fn(),
}))

import { useCursors } from './use-cursors'
import {
  onCursorChange,
  setCursorPosition,
  clearCursorPosition,
  setSelection,
  clearSelection,
} from './cursors'

let cursorCallback: ((cursors: never[]) => void) | null = null

beforeEach(() => {
  vi.clearAllMocks()
  cursorCallback = null
  ;(onCursorChange as ReturnType<typeof vi.fn>).mockImplementation(
    (cb: (cursors: never[]) => void) => {
      cursorCallback = cb
      return mockUnsubscribe
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCursors', () => {
  it('returns initial empty state', () => {
    const { result } = renderHook(() => useCursors())
    expect(result.current.cursors).toEqual([])
    expect(result.current.cursorsInView).toEqual([])
  })

  it('calls onCursorChange on mount', () => {
    renderHook(() => useCursors())
    expect(onCursorChange).toHaveBeenCalledTimes(1)
  })

  it('setCursor calls setCursorPosition with x and y', () => {
    const { result } = renderHook(() => useCursors())
    act(() => {
      result.current.setCursor(120, 340)
    })
    expect(setCursorPosition).toHaveBeenCalledWith(120, 340)
  })

  it('clearCursor calls clearCursorPosition', () => {
    const { result } = renderHook(() => useCursors())
    act(() => {
      result.current.clearCursor()
    })
    expect(clearCursorPosition).toHaveBeenCalledTimes(1)
  })

  it('select calls setSelection with start, end, text', () => {
    const { result } = renderHook(() => useCursors())
    act(() => {
      result.current.select(5, 15, 'hello world')
    })
    expect(setSelection).toHaveBeenCalledWith(5, 15, 'hello world')
  })

  it('clearSelect calls clearSelection', () => {
    const { result } = renderHook(() => useCursors())
    act(() => {
      result.current.clearSelect()
    })
    expect(clearSelection).toHaveBeenCalledTimes(1)
  })

  it('onCursorChange callback updates cursors state', () => {
    const { result } = renderHook(() => useCursors())
    const remoteCursors = [
      {
        deviceId: 'peer-1',
        name: 'Alice',
        color: '#ef4444',
        position: { x: 10, y: 20 },
        selection: null,
        currentView: 'home',
        lastUpdate: Date.now(),
      },
    ]

    act(() => {
      cursorCallback!(remoteCursors as never)
    })

    expect(result.current.cursors).toEqual(remoteCursors)
  })

  it('onCursorChange with empty array resets cursors', () => {
    const { result } = renderHook(() => useCursors())

    act(() => {
      cursorCallback!([
        {
          deviceId: 'peer-1',
          name: 'Alice',
          color: '#ef4444',
          position: null,
          selection: null,
          currentView: 'home',
          lastUpdate: 0,
        },
      ] as never)
    })
    expect(result.current.cursors).toHaveLength(1)

    act(() => {
      cursorCallback!([] as never)
    })
    expect(result.current.cursors).toEqual([])
  })

  it('filters cursorsInView when view prop is provided', () => {
    const { result } = renderHook(() => useCursors('editor'))
    const remoteCursors = [
      {
        deviceId: 'peer-1',
        name: 'Alice',
        color: '#ef4444',
        position: { x: 10, y: 20 },
        selection: null,
        currentView: 'editor',
        lastUpdate: 0,
      },
      {
        deviceId: 'peer-2',
        name: 'Bob',
        color: '#3b82f6',
        position: { x: 50, y: 60 },
        selection: null,
        currentView: 'graph',
        lastUpdate: 0,
      },
    ]

    act(() => {
      cursorCallback!(remoteCursors as never)
    })

    expect(result.current.cursors).toHaveLength(2)
    expect(result.current.cursorsInView).toHaveLength(1)
    expect(result.current.cursorsInView[0].deviceId).toBe('peer-1')
  })

  it('cursorsInView is empty when no view prop', () => {
    const { result } = renderHook(() => useCursors())
    const remoteCursors = [
      {
        deviceId: 'peer-1',
        name: 'Alice',
        color: '#ef4444',
        position: { x: 10, y: 20 },
        selection: null,
        currentView: 'editor',
        lastUpdate: 0,
      },
    ]

    act(() => {
      cursorCallback!(remoteCursors as never)
    })

    expect(result.current.cursorsInView).toEqual([])
  })

  it('cleanup unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useCursors())
    expect(mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
