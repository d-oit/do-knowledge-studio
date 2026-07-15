import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeView } from './home-view'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    section: ({ children, initial: _i, animate: _a, transition: _t, ...props }: Record<string, unknown>) => (
      <section {...props}>{children as React.ReactNode}</section>
    ),
  },
}))

// Mock lucide-react icons
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
  }
})

// Mock reduced motion hook
vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

// Store mock setup
const mockSetView = vi.fn()
const mockStartNew = vi.fn()
const mockStartEdit = vi.fn()

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
  {
    id: 'ent-2',
    name: 'Second Entity',
    type: 'note',
    description: 'A test note',
    content: '# Second',
    updatedAt: new Date(Date.now() - 3600_000).toISOString(),
    links: ['ent-1'],
    tags: [],
    sourceUrl: '',
  },
]

const mockStats = {
  total: 2,
  claims: 1,
  verified: 0,
  connections: 1,
  byType: { note: 1, concept: 1, person: 0, project: 0 },
}

let currentEntities = mockEntities
let currentStats = mockStats

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setView: mockSetView,
      startNew: mockStartNew,
      startEdit: mockStartEdit,
      entities: currentEntities,
    }),
  useStats: () => currentStats,
}))

describe('HomeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentStats = mockStats
  })

  it('renders today date in greeting row', () => {
    render(<HomeView />)
    const dateText = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date())
    expect(screen.getByText(dateText)).toBeDefined()
  })

  it('renders compact stats row with entity count', () => {
    render(<HomeView />)
    expect(screen.getByText('Entities')).toBeDefined()
  })

  it('renders recent entities list', () => {
    render(<HomeView />)
    expect(screen.getByText('First Entity')).toBeDefined()
    expect(screen.getByText('Second Entity')).toBeDefined()
  })

  it('renders Recent work heading', () => {
    render(<HomeView />)
    expect(screen.getByText('Recent work')).toBeDefined()
  })

  it('calls startNew when New entity button is clicked', () => {
    render(<HomeView />)
    const btn = screen.getByRole('button', { name: /new entity/i })
    fireEvent.click(btn)
    expect(mockStartNew).toHaveBeenCalledOnce()
  })

  it('calls startEdit when a recent entity row is clicked', () => {
    render(<HomeView />)
    const row = screen.getByText('First Entity').closest('button')
    expect(row).toBeDefined()
    if (row) fireEvent.click(row)
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('renders empty state when no entities', () => {
    currentEntities = []
    currentStats = { total: 0, claims: 0, verified: 0, connections: 0, byType: { note: 0, concept: 0, person: 0, project: 0 } }
    render(<HomeView />)
    expect(screen.getByText(/No entities yet/)).toBeDefined()
  })

  it('renders type breakdown section when entities exist', () => {
    render(<HomeView />)
    expect(screen.getByText('By type')).toBeDefined()
  })

  it('renders tip section', () => {
    render(<HomeView />)
    expect(screen.getByText('Tip')).toBeDefined()
  })
})
