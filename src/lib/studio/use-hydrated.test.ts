import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStoreHydrated } from './use-hydrated'
import { useStudioStore } from './store'

describe('useStoreHydrated', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when store is already hydrated', () => {
    vi.spyOn(useStudioStore.persist, 'hasHydrated').mockReturnValue(true)
    const { result } = renderHook(() => useStoreHydrated())
    expect(result.current).toBe(true)
  })

  it('updates to true when hydration finishes', () => {
    let callback: (() => void) | undefined
    vi.spyOn(useStudioStore.persist, 'hasHydrated').mockReturnValue(false)
    vi.spyOn(useStudioStore.persist, 'onFinishHydration').mockImplementation((cb) => {
      callback = cb
      return () => {
        callback = undefined
      }
    })

    const { result } = renderHook(() => useStoreHydrated())
    expect(result.current).toBe(false)

    act(() => {
      callback?.()
    })

    expect(result.current).toBe(true)
  })

  it('cleans up hydration listener on unmount', () => {
    const unsubSpy = vi.fn()
    vi.spyOn(useStudioStore.persist, 'onFinishHydration').mockReturnValue(unsubSpy)

    const { unmount } = renderHook(() => useStoreHydrated())
    unmount()

    expect(unsubSpy).toHaveBeenCalledTimes(1)
  })
})
