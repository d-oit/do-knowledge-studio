import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { HomeView } from './home-view'


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
  it('renders the progress bar at zero width during server rendering', () => {
    const serverHtml = renderToString(<HomeView />)
    expect(serverHtml).toContain('style="width:0%"')
  })

  it('applies the hydrated store percentage after mount', () => {
    render(<HomeView />)
    expect(screen.getByTestId('type-progress-bar').style.width).toBe('100%')
  })
})
