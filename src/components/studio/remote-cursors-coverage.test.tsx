import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

// Hoisted so the vi.mock factory (hoisted above imports) can reference these safely.
const syncMocks = vi.hoisted(() => ({
  cursorsInView: [] as Array<{
    deviceId: string
    name: string
    color: string
    position: { x: number; y: number } | null
  }>,
  setCursor: vi.fn(),
  clearCursor: vi.fn(),
  select: vi.fn(),
  clearSelect: vi.fn(),
}))

vi.mock('@/lib/sync/use-cursors', () => ({
  useCursors: () => ({
    cursorsInView: syncMocks.cursorsInView,
    setCursor: syncMocks.setCursor,
    clearCursor: syncMocks.clearCursor,
    select: syncMocks.select,
    clearSelect: syncMocks.clearSelect,
  }),
}))

import { CursorTracker } from './remote-cursors'

const RECT = {
  left: 10,
  top: 20,
  right: 110,
  bottom: 120,
  width: 100,
  height: 100,
  x: 10,
  y: 20,
  toJSON: () => ({}),
} as DOMRect

const renderTracker = () =>
  render(
    <CursorTracker view="home">
      <p>Tracked content</p>
    </CursorTracker>,
  )

const fireSelectionChange = () => {
  document.dispatchEvent(new Event('selectionchange'))
}

describe('CursorTracker branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncMocks.cursorsInView = []
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('updates remote cursor position on mouse move', () => {
    const { container } = renderTracker()
    const tracked = container.firstElementChild as HTMLElement
    vi.spyOn(tracked, 'getBoundingClientRect').mockReturnValue(RECT)
    fireEvent.mouseMove(tracked, { clientX: 60, clientY: 70 })
    expect(syncMocks.setCursor).toHaveBeenCalledWith(50, 50)
  })

  it('sends selection with offsets and text when text is selected', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      toString: () => 'selected text',
      getRangeAt: () => ({ startOffset: 3, endOffset: 9 }),
    } as unknown as Selection)
    renderTracker()
    fireSelectionChange()
    expect(syncMocks.select).toHaveBeenCalledWith(3, 9, 'selected text')
    expect(syncMocks.clearSelect).not.toHaveBeenCalled()
  })

  it('clears selection when getSelection returns null', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue(null)
    renderTracker()
    fireSelectionChange()
    expect(syncMocks.clearSelect).toHaveBeenCalled()
    expect(syncMocks.select).not.toHaveBeenCalled()
  })

  it('clears selection when there are no ranges', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 0,
      toString: () => '',
      getRangeAt: () => ({ startOffset: 0, endOffset: 0 }),
    } as unknown as Selection)
    renderTracker()
    fireSelectionChange()
    expect(syncMocks.clearSelect).toHaveBeenCalled()
    expect(syncMocks.select).not.toHaveBeenCalled()
  })

  it('clears selection when selection text is whitespace only', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      toString: () => '   ',
      getRangeAt: () => ({ startOffset: 1, endOffset: 3 }),
    } as unknown as Selection)
    renderTracker()
    fireSelectionChange()
    expect(syncMocks.clearSelect).toHaveBeenCalled()
    expect(syncMocks.select).not.toHaveBeenCalled()
  })
})
