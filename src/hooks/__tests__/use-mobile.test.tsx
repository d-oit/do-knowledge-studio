import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// useIsMobile reads window.matchMedia and window.innerWidth.
// Mock matchMedia before each test with a controllable listener registry.
// ---------------------------------------------------------------------------

let matchMediaListener: ((e: MediaQueryListEvent) => void) | null = null
let matchMediaMatches = false

function createMatchMedia() {
  return vi.fn().mockImplementation((query: string) => ({
    matches: matchMediaMatches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, cb: EventListener) => {
      if (event === 'change') {
        matchMediaListener = cb as (e: MediaQueryListEvent) => void
      }
    }),
    removeEventListener: vi.fn((event: string, _cb: EventListener) => {
      if (event === 'change') {
        matchMediaListener = null
      }
    }),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  matchMediaListener = null
  matchMediaMatches = false
  vi.stubGlobal('matchMedia', createMatchMedia())
  vi.stubGlobal('innerWidth', 1024)
})

// ---------------------------------------------------------------------------
// useIsMobile
// ---------------------------------------------------------------------------

describe('useIsMobile', () => {
  it('returns false by default on desktop', async () => {
    // Reset module to pick up fresh mock
    vi.resetModules()
    const mod = await import('@/hooks/use-mobile')
    const useIsMobile = mod.useIsMobile

    const { result } = renderHook(() => useIsMobile())

    // After mount, innerWidth(1024) >= 768 so isMobile is false
    expect(result.current).toBe(false)
  })

  it('returns true when window width is below 768px', async () => {
    vi.stubGlobal('innerWidth', 480)

    vi.resetModules()
    const mod = await import('@/hooks/use-mobile')
    const useIsMobile = mod.useIsMobile

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('responds to media query change events', async () => {
    vi.stubGlobal('innerWidth', 1024)

    vi.resetModules()
    const mod = await import('@/hooks/use-mobile')
    const useIsMobile = mod.useIsMobile

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    // Simulate resize: width drops below 768
    act(() => {
      vi.stubGlobal('innerWidth', 400)
      matchMediaListener?.({
        matches: true,
        media: '(max-width: 767px)',
      } as MediaQueryListEvent)
    })

    expect(result.current).toBe(true)
  })

  it('responds to media query change event back to desktop', async () => {
    vi.stubGlobal('innerWidth', 400)

    vi.resetModules()
    const mod = await import('@/hooks/use-mobile')
    const useIsMobile = mod.useIsMobile

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)

    act(() => {
      vi.stubGlobal('innerWidth', 1200)
      matchMediaListener?.({ matches: false } as MediaQueryListEvent)
    })

    expect(result.current).toBe(false)
  })

  it('registers and cleans up matchMedia listener', async () => {
    vi.resetModules()
    const mod = await import('@/hooks/use-mobile')
    const useIsMobile = mod.useIsMobile

    const { unmount } = renderHook(() => useIsMobile())

    // Listener should be registered after mount
    expect(matchMediaListener).not.toBeNull()

    unmount()
    // After unmount, listener should be cleaned up (our mock sets it to null)
    expect(matchMediaListener).toBeNull()
  })
})
