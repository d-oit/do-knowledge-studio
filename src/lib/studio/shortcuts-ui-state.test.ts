import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from './store'

describe('shortcuts dialog store state', () => {
  beforeEach(() => {
    useStudioStore.getState().setShortcutsOpen(false)
  })

  it('owns open and close transitions in the Zustand store', () => {
    useStudioStore.getState().setShortcutsOpen(true)
    expect(useStudioStore.getState().shortcutsOpen).toBe(true)

    useStudioStore.getState().setShortcutsOpen(false)
    expect(useStudioStore.getState().shortcutsOpen).toBe(false)
  })
})
