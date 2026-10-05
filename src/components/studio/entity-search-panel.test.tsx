import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Search: Icon, FileText: Icon, X: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/entity-types', () => ({
  getEntityTypeMeta: (type: string) => ({
    label: type.toUpperCase(),
    dot: 'bg-blue-500',
  }),
}))

const searchMock = vi.fn(() => [])
vi.mock('@/lib/search/retrieval', () => ({
  search: (...args: unknown[]) => searchMock(...(args as [])),
}))

const mockStartEdit = vi.fn()
const mockSetSearchQuery = vi.fn()
const mockOnSelect = vi.fn()
const mockOnCreateEntity = vi.fn()

let searchQuery = ''
const mockEntities = [
  {
    id: 'ent-1',
    name: 'Alpha Concept',
    type: 'concept' as const,
    description: 'First test concept',
    content: '',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
  {
    id: 'ent-2',
    name: 'Beta Reference',
    type: 'reference' as const,
    description: 'Second test reference',
    content: '',
    tags: ['ref'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      searchQuery,
      setSearchQuery: mockSetSearchQuery,
      entities: mockEntities,
      claims: [],
      startEdit: mockStartEdit,
    }),
  useFilteredEntities: () => (searchQuery === 'nomatch' ? [] : mockEntities),
}))

import { EntitySearchPanel } from './entity-search-panel'

describe('EntitySearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchQuery = ''
    searchMock.mockReturnValue([])
  })

  it('renders search input with aria-label, title, and placeholder', () => {
    render(<EntitySearchPanel />)
    const input = screen.getByLabelText('Search knowledge base') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.type).toBe('search')
    expect(input.placeholder).toBe('Search knowledge base…')
  })

  it('renders mode toggle buttons with min-h-[44px]', () => {
    render(<EntitySearchPanel />)
    const keywordBtn = screen.getByRole('button', { name: 'Keyword' })
    const rankedBtn = screen.getByRole('button', { name: 'Ranked' })
    expect(keywordBtn.className).toContain('min-h-[44px]')
    expect(rankedBtn.className).toContain('min-h-[44px]')
  })

  it('switches between keyword and ranked modes', () => {
    render(<EntitySearchPanel />)
    const keywordBtn = screen.getByRole('button', { name: 'Keyword' })
    const rankedBtn = screen.getByRole('button', { name: 'Ranked' })

    expect(keywordBtn).toHaveAttribute('aria-pressed', 'true')
    expect(rankedBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(rankedBtn)
    expect(rankedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(keywordBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders keyword results and handles clicking a row', () => {
    render(<EntitySearchPanel onSelect={mockOnSelect} />)
    const alphaBtn = screen.getByText('Alpha Concept').closest('button')
    expect(alphaBtn).not.toBeNull()
    expect(alphaBtn?.className).toContain('min-h-[44px]')

    fireEvent.click(alphaBtn!)
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
    expect(mockOnSelect).toHaveBeenCalledWith('ent-1')
  })

  it('renders ranked search results when in ranked mode', () => {
    searchQuery = 'Alpha'
    searchMock.mockReturnValue([
      { id: 'ent-1', name: 'Alpha Concept', snippet: 'A snippet', score: 0.95, type: 'entity' },
    ])

    render(<EntitySearchPanel onSelect={mockOnSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ranked' }))

    expect(screen.getByText('A snippet')).toBeDefined()
    expect(screen.getByText('0.9')).toBeDefined()

    const resultRow = screen.getByLabelText(/score 0.95/)
    expect(resultRow.className).toContain('min-h-[44px]')

    fireEvent.click(resultRow)
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
    expect(mockOnSelect).toHaveBeenCalledWith('ent-1')
  })

  it('clears query when clear button or Escape key is used', () => {
    searchQuery = 'test query'
    render(<EntitySearchPanel />)

    const clearBtn = screen.getByLabelText('Clear panel search')
    expect(clearBtn.className).toContain('min-h-[44px]')
    fireEvent.click(clearBtn)
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')

    const input = screen.getByLabelText('Search knowledge base')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
  })

  it('renders empty state and creation button when query returns no results', () => {
    searchQuery = 'nomatch'
    render(<EntitySearchPanel onCreateEntity={mockOnCreateEntity} />)

    expect(screen.getByText('No matches found.')).toBeDefined()
    const createBtn = screen.getByRole('button', { name: 'Create "nomatch" as new entity' })
    expect(createBtn.className).toContain('min-h-[44px]')

    fireEvent.click(createBtn)
    expect(mockOnCreateEntity).toHaveBeenCalledWith('nomatch')
  })

  it('announces result counts in aria-live region when query is active', () => {
    searchQuery = 'test'
    render(<EntitySearchPanel />)

    const statusRegion = screen.getByRole('status', { hidden: true })
    expect(statusRegion.textContent).toBe('2 search results found')
  })

  it('renders correctly with drawer density', () => {
    render(<EntitySearchPanel density="drawer" />)
    expect(screen.getByText('Local search · 2 entities')).toBeDefined()
  })
})
