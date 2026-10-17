import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { HomeView } from './home-view'

/**
 * Records every width target the progress bars receive, across both the server
 * render and the post-mount client render, so the test can prove the server
 * pass is reproduced by the first client render (width 0) and only then does
 * the store-derived percentage land.
 */
const mockAnimateWidths: unknown[] = []
const mockBarTransitions: unknown[] = []

vi.mock('framer-motion', () => {
  const div = ({
    children,
    animate,
    initial: _initial,
    transition,
    ...props
  }: {
    children?: ReactNode
    animate?: { width?: unknown }
    initial?: unknown
    transition?: unknown
    [key: string]: unknown
  }) => {
    mockAnimateWidths.push(animate?.width)
    mockBarTransitions.push(transition)
    return (
      <div
        data-testid="progress-bar"
        data-animate-width={String(animate?.width)}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    )
  }
  const section = ({
    children,
    initial: _initial,
    animate: _animate,
    transition: _transition,
    ...props
  }: { children?: ReactNode; [key: string]: unknown }) => (
    <section {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</section>
  )
  return { motion: { div, section } }
})

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    FileText: Icon,
    Lightbulb: Icon,
    User: Icon,
    FolderKanban: Icon,
    ArrowUpRight: Icon,
    TrendingUp: Icon,
    CheckCircle2: Icon,
    Quote: Icon,
    Clock: Icon,
    Sparkles: Icon,
    LayoutDashboard: Icon,
  }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

const mockEntities = [
  {
    id: 'ent-1',
    name: 'First Entity',
    type: 'concept',
    description: 'A test concept',
    content: '# First',
    updatedAt: new Date().toISOString(),
    links: [],
    tags: [],
    sourceUrl: '',
  },
]

/** One type only, so the breakdown renders a single, unambiguous progress bar. */
const mockStats = {
  total: 1,
  claims: 0,
  verified: 0,
  connections: 0,
  byType: { concept: 1 },
}

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setView: vi.fn(),
      startNew: vi.fn(),
      startEdit: vi.fn(),
      entities: mockEntities,
    }),
  useStats: () => mockStats,
}))

describe('HomeView type-progress rendering', () => {
  beforeEach(() => {
    mockAnimateWidths.length = 0
    mockBarTransitions.length = 0
  })

  it('renders the progress bar at 0 on the server pass, and the first client render matches it', () => {
    const serverHtml = renderToString(<HomeView />)
    expect(serverHtml).toContain('data-animate-width="0"')

    mockAnimateWidths.length = 0
    render(<HomeView />)

    // First client render (before the mount effect) must equal the server pass.
    expect(mockAnimateWidths[0]).toBe(0)
  })

  it('applies the store percentage after effects, keeping the ease-out transition', () => {
    render(<HomeView />)

    const bar = screen.getByTestId('progress-bar')
    expect(bar.getAttribute('data-animate-width')).toBe('100%')
    expect(mockAnimateWidths.at(-1)).toBe('100%')
    expect(mockBarTransitions.at(-1)).toEqual({ duration: 0.6, ease: 'easeOut' })
  })
})
