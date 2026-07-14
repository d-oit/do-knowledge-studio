import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReducedMotion } from './use-reduced-motion'

// Mock matchMedia
const listeners: Set<(e: MediaQueryListEvent) => void> = new Set()
let mockMatches = false

function createMockMql() {
  return {
    get matches() { return mockMatches },
    addEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  }
}

beforeEach(() => {
  listeners.clear()
  mockMatches = false
  vi.stubGlobal('matchMedia', vi.fn(() => createMockMql()))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useReducedMotion', () => {
  it('returns false when matchMedia does not match', () => {
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when matchMedia matches', () => {
    mockMatches = true
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('responds to runtime preference changes', () => {
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      mockMatches = true
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }
    })
    expect(result.current).toBe(true)

    act(() => {
      mockMatches = false
      for (const listener of listeners) {
        listener({ matches: false } as MediaQueryListEvent)
      }
    })
    expect(result.current).toBe(false)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion())
    expect(listeners.size).toBe(1)
    unmount()
    expect(listeners.size).toBe(0)
  })
})


