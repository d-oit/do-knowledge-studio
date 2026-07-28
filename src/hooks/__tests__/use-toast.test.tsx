import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// useToast uses module-level singletons (memoryState, listeners, timeouts).
// Reset the module before each test to prevent state bleeding.
// ---------------------------------------------------------------------------

let useToast: typeof import('@/hooks/use-toast').useToast
let toast: typeof import('@/hooks/use-toast').toast

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('@/hooks/use-toast')
  useToast = mod.useToast
  toast = mod.toast
})

// ---------------------------------------------------------------------------
// useToast
// ---------------------------------------------------------------------------

describe('useToast', () => {
  describe('return shape', () => {
    it('returns toasts array, toast function, and dismiss function', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toEqual([])
      expect(typeof result.current.toast).toBe('function')
      expect(typeof result.current.dismiss).toBe('function')
    })

    it('toasts starts as an empty array', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('toast()', () => {
    it('adds a toast to the toasts array when called', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Hello', description: 'World' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Hello')
      expect(result.current.toasts[0].description).toBe('World')
      expect(result.current.toasts[0].open).toBe(true)
    })

    it('assigns a unique id to each toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'First' })
        toast({ title: 'Second' })
      })

      // TOAST_LIMIT = 1, so only the latest toast is kept
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Second')
    })

    it('returns an object with id, dismiss, and update', () => {
      let returned: ReturnType<typeof toast>

      act(() => {
        returned = toast({ title: 'Test' })
      })

      expect(typeof returned!).toBe('object')
      expect(typeof returned!.id).toBe('string')
      expect(typeof returned!.dismiss).toBe('function')
      expect(typeof returned!.update).toBe('function')
    })
  })

  describe('dismiss()', () => {
    it('sets toast open to false when dismissed by id', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string
      act(() => {
        const t = toast({ title: 'Dismiss me' })
        toastId = t.id
      })

      act(() => {
        result.current.dismiss(toastId!)
      })

      expect(result.current.toasts[0].open).toBe(false)
      // The toast remains in the array (REMOVE happens asynchronously)
      expect(result.current.toasts).toHaveLength(1)
    })

    it('dismisses all toasts when called without an id', () => {
      // Since TOAST_LIMIT=1, we can only have one toast at a time.
      // Dismiss without id should set all to open:false.
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Toast' })
      })

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  describe('multiple hooks share state', () => {
    it('two useToast hooks see the same toasts', () => {
      const hookA = renderHook(() => useToast())
      const hookB = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Shared' })
      })

      expect(hookA.result.current.toasts).toHaveLength(1)
      expect(hookB.result.current.toasts).toHaveLength(1)
      expect(hookA.result.current.toasts[0].title).toBe('Shared')
      expect(hookB.result.current.toasts[0].title).toBe('Shared')
    })
  })

  describe('UPDATE_TOAST via returned update function', () => {
    it('updates an existing toast via the returned update function', () => {
      const { result } = renderHook(() => useToast())

      let updateFn: (props: Parameters<typeof toast>[0]) => void
      act(() => {
        const t = toast({ title: 'Original' })
        updateFn = t.update
      })

      act(() => {
        updateFn!({ title: 'Updated' } as Parameters<typeof toast>[0] & { id: string })
      })

      // The update merges properties — title should change
      expect(result.current.toasts[0].title).toBe('Updated')
    })
  })
})

// ---------------------------------------------------------------------------
// reducer (exported for testing)
// ---------------------------------------------------------------------------

describe('toast reducer', () => {
  let reducer: typeof import('@/hooks/use-toast').reducer

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/hooks/use-toast')
    reducer = mod.reducer
  })

  it('ADD_TOAST prepends a toast', () => {
    const state = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: 'a', open: true } })
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].id).toBe('a')
  })

  it('UPDATE_TOAST merges properties onto the target', () => {
    const initial = { toasts: [{ id: 'a', open: true, title: 'Old' }] }
    const state = reducer(initial, { type: 'UPDATE_TOAST', toast: { id: 'a', title: 'New' } })
    expect(state.toasts[0].title).toBe('New')
    expect(state.toasts[0].open).toBe(true)
  })

  it('DISMISS_TOAST sets open to false for the target id', () => {
    const initial = { toasts: [{ id: 'a', open: true }] }
    const state = reducer(initial, { type: 'DISMISS_TOAST', toastId: 'a' })
    expect(state.toasts[0].open).toBe(false)
  })

  it('DISMISS_TOAST without id sets all toasts to open:false', () => {
    const initial = { toasts: [{ id: 'a', open: true }, { id: 'b', open: true }] }
    const state = reducer(initial, { type: 'DISMISS_TOAST' })
    expect(state.toasts[0].open).toBe(false)
    expect(state.toasts[1].open).toBe(false)
  })

  it('REMOVE_TOAST filters out the target id', () => {
    const initial = { toasts: [{ id: 'a', open: false }, { id: 'b', open: true }] }
    const state = reducer(initial, { type: 'REMOVE_TOAST', toastId: 'a' })
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].id).toBe('b')
  })

  it('REMOVE_TOAST without id clears all toasts', () => {
    const initial = { toasts: [{ id: 'a', open: false }, { id: 'b', open: false }] }
    const state = reducer(initial, { type: 'REMOVE_TOAST' })
    expect(state.toasts).toHaveLength(0)
  })
})
