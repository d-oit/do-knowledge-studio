import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

let cursorsInView: Array<{
  deviceId: string
  name: string
  color: string
  position: { x: number; y: number } | null
}> = []
const mockSetCursor = vi.fn()
const mockClearCursor = vi.fn()
const mockSelect = vi.fn()
const mockClearSelect = vi.fn()

vi.mock('@/lib/sync/use-cursors', () => ({
  useCursors: () => ({
    cursorsInView,
    setCursor: mockSetCursor,
    clearCursor: mockClearCursor,
    select: mockSelect,
    clearSelect: mockClearSelect,
  }),
}))

import { RemoteCursors, CursorTracker } from './remote-cursors'

describe('RemoteCursors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cursorsInView = []
  })

  it('renders empty container when no cursors', () => {
    const { container } = render(<RemoteCursors />)
    expect(container.firstElementChild?.children.length).toBe(0)
  })

  it('renders cursor overlays for each cursor', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 100, y: 200 } },
      { deviceId: 'd2', name: 'Bob', color: '#00ff00', position: { x: 300, y: 400 } },
    ]
    render(<RemoteCursors />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('hides cursors without position', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: null },
    ]
    render(<RemoteCursors />)
    expect(screen.queryByText('Alice')).toBeNull()
  })

  it('renders SVG cursor arrow', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 50, y: 50 } },
    ]
    const { container } = render(<RemoteCursors />)
    expect(container.querySelector('svg')).toBeDefined()
  })

  it('positions cursor at correct coordinates', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 150, y: 250 } },
    ]
    const { container } = render(<RemoteCursors />)
    const overlay = container.querySelector('.absolute.transition-all') as HTMLElement | null
    expect(overlay).toBeDefined()
    // JSDOM appends 'px' to numeric style values
    expect(overlay?.style.left).toBe('150px')
    expect(overlay?.style.top).toBe('250px')
  })

  it('applies custom className', () => {
    const { container } = render(<RemoteCursors className="custom" />)
    expect(container.firstElementChild?.className).toContain('custom')
  })

  it('renders name label with cursor color', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 50, y: 50 } },
    ]
    render(<RemoteCursors />)
    // JSDOM converts hex to rgb()
    const label = screen.getByText('Alice') as HTMLElement
    expect(label.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('renders multiple cursors with different colors', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 10, y: 10 } },
      { deviceId: 'd2', name: 'Bob', color: '#0000ff', position: { x: 20, y: 20 } },
    ]
    render(<RemoteCursors />)
    expect((screen.getByText('Alice') as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect((screen.getByText('Bob') as HTMLElement).style.backgroundColor).toBe('rgb(0, 0, 255)')
  })
})

describe('CursorTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cursorsInView = []
  })

  it('renders children', () => {
    render(
      <CursorTracker view="home">
        <p>Tracked content</p>
      </CursorTracker>,
    )
    expect(screen.getByText('Tracked content')).toBeDefined()
  })

  it('renders RemoteCursors overlay', () => {
    cursorsInView = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', position: { x: 10, y: 10 } },
    ]
    render(
      <CursorTracker view="home">
        <p>Content</p>
      </CursorTracker>,
    )
    expect(screen.getByText('Alice')).toBeDefined()
  })

  it('calls clearCursor on mouse leave', () => {
    const { container } = render(
      <CursorTracker view="home">
        <p>Content</p>
      </CursorTracker>,
    )
    fireEvent.mouseLeave(container.firstElementChild!)
    expect(mockClearCursor).toHaveBeenCalled()
  })

  it('calls clearSelect and clearCursor on unmount', () => {
    const { unmount } = render(
      <CursorTracker view="home">
        <p>Content</p>
      </CursorTracker>,
    )
    unmount()
    expect(mockClearCursor).toHaveBeenCalled()
    expect(mockClearSelect).toHaveBeenCalled()
  })

  it('container has relative positioning', () => {
    const { container } = render(
      <CursorTracker view="home">
        <p>Content</p>
      </CursorTracker>,
    )
    expect(container.firstElementChild?.className).toContain('relative')
  })
})
