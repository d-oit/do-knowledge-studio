import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import type { Entity } from '@/lib/studio/types'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    FileText: Icon,
    Lightbulb: Icon,
    User: Icon,
    FolderKanban: Icon,
    Clock: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

type VirtualItemLike = { key: string; index: number; start: number; size: number }
type VirtualizerLike = {
  getVirtualItems: () => VirtualItemLike[]
  getTotalSize: () => number
  measureElement: (node: Element) => void
}

/** Controlled return values for the mocked useVirtualizer (per-test). */
const mockVirtualizerState = {
  items: [] as VirtualItemLike[],
  totalSize: 0,
}

const mockUseVirtualizer = vi.fn<(options: object) => VirtualizerLike>()

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (...args: unknown[]) => mockUseVirtualizer(...(args as [object])),
}))

/** jsdom reports 0 for clientHeight; flip this to force the measurable path. */
let mockClientHeight = 0

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => mockClientHeight,
  })
})

const makeEntity = (i: number): Entity => ({
  id: `ent-${i}`,
  name: `Entity ${i}`,
  type: 'note',
  description: `Description ${i}`,
  content: '',
  tags: ['tag'],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-15T00:00:00Z',
  links: [],
})

const makeEntities = (count: number): Entity[] => Array.from({ length: count }, (_, i) => makeEntity(i))

import { EntityGrid, EntityTable, shouldVirtualize } from './library-entities'

describe('shouldVirtualize', () => {
  it('requires both a measurable container and a large list', () => {
    expect(shouldVirtualize(false, 1000)).toBe(false)
    expect(shouldVirtualize(true, 64)).toBe(false)
    expect(shouldVirtualize(true, 65)).toBe(true)
  })
})

describe('EntityGrid', () => {
  beforeEach(() => {
    mockClientHeight = 0
    mockVirtualizerState.items = []
    mockVirtualizerState.totalSize = 0
    mockUseVirtualizer.mockReturnValue({
      getVirtualItems: () => mockVirtualizerState.items,
      getTotalSize: () => mockVirtualizerState.totalSize,
      measureElement: () => undefined,
    })
  })

  it('renders all cards eagerly when the container is not measurable (jsdom)', () => {
    render(<EntityGrid entities={makeEntities(2)} startEdit={vi.fn()} />)
    expect(screen.getByText('Entity 0')).toBeDefined()
    expect(screen.getByText('Entity 1')).toBeDefined()
  })

  it('renders only windowed rows when virtualization is active', () => {
    const entities = makeEntities(100)
    mockClientHeight = 600
    mockVirtualizerState.items = [
      { key: 'row-10', index: 10, start: 1500, size: 150 },
      { key: 'row-11', index: 11, start: 1650, size: 150 },
    ]
    mockVirtualizerState.totalSize = 15000

    const { container } = render(<EntityGrid entities={entities} startEdit={vi.fn()} />)

    // Only the windowed entities exist in the DOM.
    expect(screen.getByText('Entity 10')).toBeDefined()
    expect(screen.getByText('Entity 11')).toBeDefined()
    expect(screen.queryByText('Entity 0')).toBeNull()
    expect(screen.queryByText('Entity 99')).toBeNull()

    // The spacer tracks the full virtual height.
    const spacer = container.querySelector('div.relative')
    expect(spacer).not.toBeNull()
    expect((spacer as HTMLElement).style.height).toBe('15000px')

    // The virtualizer is wired with the correct row count and overscan.
    expect(mockUseVirtualizer).toHaveBeenCalledWith(
      expect.objectContaining({ count: 100, overscan: 8, estimateSize: expect.any(Function) }),
    )
  })
})

describe('EntityTable', () => {
  beforeEach(() => {
    mockClientHeight = 0
    mockVirtualizerState.items = []
    mockVirtualizerState.totalSize = 0
    mockUseVirtualizer.mockReturnValue({
      getVirtualItems: () => mockVirtualizerState.items,
      getTotalSize: () => mockVirtualizerState.totalSize,
      measureElement: () => undefined,
    })
  })

  it('renders all rows eagerly when the container is not measurable (jsdom)', () => {
    render(<EntityTable entities={makeEntities(2)} startEdit={vi.fn()} />)
    const rows = screen.getAllByRole('link')
    expect(rows).toHaveLength(2)
  })

  it('renders only windowed rows with absolute positioning when virtualized', () => {
    const entities = makeEntities(100)
    mockClientHeight = 600
    mockVirtualizerState.items = [
      { key: 'row-10', index: 10, start: 560, size: 56 },
      { key: 'row-11', index: 11, start: 616, size: 56 },
    ]
    mockVirtualizerState.totalSize = 5600

    const { container } = render(<EntityTable entities={entities} startEdit={vi.fn()} />)

    const rows = screen.getAllByRole('link')
    expect(rows).toHaveLength(2)
    expect(rows[0].dataset.index).toBe('10')
    expect(rows[1].dataset.index).toBe('11')
    expect(screen.queryByText('Entity 0')).toBeNull()

    // Windowed rows are absolutely positioned by their virtual offset.
    expect((rows[0] as HTMLElement).style.transform).toBe('translateY(560px)')

    // The tbody acts as the spacer for the full virtual height.
    const tbody = container.querySelector('tbody')
    expect((tbody as HTMLElement).style.height).toBe('5600px')
    expect((tbody as HTMLElement).style.position).toBe('relative')
  })
})
