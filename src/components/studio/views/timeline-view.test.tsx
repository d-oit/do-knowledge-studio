import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { format } from 'date-fns'
import type { Claim, Entity } from '@/lib/studio/types'
import { buildTimelineGroups } from './timeline-helpers'
import { TimelineView } from './timeline-view'

const mockStartEdit = vi.fn()
const mockSetView = vi.fn()
const mockStartNew = vi.fn()

let mockEntities: Entity[] = []
let mockClaims: Claim[] = []

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      entities: mockEntities,
      claims: mockClaims,
      startEdit: mockStartEdit,
      setView: mockSetView,
      startNew: mockStartNew,
    }),
}))

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'e1',
  name: 'Alpha Note',
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-09-08T12:00:00',
  updatedAt: '2026-09-08T12:00:00',
  links: [],
  ...overrides,
})

const makeClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'c1',
  entityId: 'e1',
  statement: 'A testable claim',
  confidence: 0.8,
  verification: 'unverified',
  ...overrides,
})

describe('buildTimelineGroups', () => {
  it('returns no groups for empty data', () => {
    expect(buildTimelineGroups([], [])).toEqual([])
  })

  it('groups a single entity into one month band with one day band', () => {
    const groups = buildTimelineGroups([makeEntity()], [])
    expect(groups).toHaveLength(1)
    expect(groups[0].days).toHaveLength(1)
    expect(groups[0].days[0].items).toHaveLength(1)
    const item = groups[0].days[0].items[0]
    expect(item).toMatchObject({ kind: 'entity', id: 'e1', label: 'Alpha Note', entityType: 'note' })
  })

  it('splits same-month different-day entities into separate day bands', () => {
    const entities = [
      makeEntity({ id: 'e1', name: 'Older', createdAt: '2026-09-01T09:00:00' }),
      makeEntity({ id: 'e2', name: 'Newer', createdAt: '2026-09-08T09:00:00' }),
    ]
    const groups = buildTimelineGroups(entities, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].days).toHaveLength(2)
    // Newest day band first
    expect(groups[0].days[0].items[0].id).toBe('e2')
    expect(groups[0].days[1].items[0].id).toBe('e1')
  })

  it('splits month boundaries into separate month bands, newest first', () => {
    const entities = [
      makeEntity({ id: 'e1', name: 'August', createdAt: '2026-08-31T09:00:00' }),
      makeEntity({ id: 'e2', name: 'September', createdAt: '2026-09-01T09:00:00' }),
    ]
    const groups = buildTimelineGroups(entities, [])
    expect(groups).toHaveLength(2)
    expect(groups[0].days[0].items[0].id).toBe('e2')
    expect(groups[1].days[0].items[0].id).toBe('e1')
  })

  it('places a claim on its own createdAt when present', () => {
    const claim = makeClaim({ createdAt: '2026-09-10T09:00:00' })
    const groups = buildTimelineGroups([makeEntity()], [claim])
    expect(groups[0].days[0].items[0]).toMatchObject({
      kind: 'claim',
      id: 'c1',
      entityId: 'e1',
    })
    expect(groups[0].days[0].items[0].date).toEqual(new Date('2026-09-10T09:00:00'))
  })

  it('falls back to the owning entity createdAt when a claim has none', () => {
    const entity = makeEntity({ id: 'e1', createdAt: '2026-09-08T12:00:00' })
    const claim = makeClaim({ entityId: 'e1' })
    const groups = buildTimelineGroups([entity], [claim])
    expect(groups[0].days[0].items[0]).toMatchObject({
      kind: 'claim',
      id: 'c1',
      entityId: 'e1',
    })
    expect(groups[0].days[0].items[0].date).toEqual(new Date('2026-09-08T12:00:00'))
  })

  it('skips orphan claims with no createdAt and no known entity', () => {
    const groups = buildTimelineGroups([], [makeClaim({ entityId: 'ghost' })])
    expect(groups).toEqual([])
  })

  it('orders items newest first within a day, ties broken by label', () => {
    const entity = makeEntity({ createdAt: '2026-09-08T08:00:00' })
    const claims = [
      makeClaim({ id: 'c1', statement: 'Zulu claim', createdAt: '2026-09-08T10:00:00' }),
      makeClaim({ id: 'c2', statement: 'Alpha claim', createdAt: '2026-09-08T10:00:00' }),
      makeClaim({ id: 'c3', statement: 'Early claim', createdAt: '2026-09-08T06:00:00' }),
    ]
    const groups = buildTimelineGroups([entity], claims)
    const items = groups[0].days[0].items
    // Equal timestamps tie-break alphabetically by label: 'Alpha claim' before 'Zulu claim'.
    expect(items.map((item) => item.id)).toEqual(['c2', 'c1', 'e1', 'c3'])
  })
})

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEntities = []
    mockClaims = []
  })

  it('renders the view title and subtitle', () => {
    render(<TimelineView />)
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeDefined()
    expect(screen.getByText(/grouped by when they were created/i)).toBeDefined()
  })

  it('shows the empty state when there is nothing to plot', () => {
    render(<TimelineView />)
    expect(screen.getByText('Nothing here yet')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Create an entity' }))
    expect(mockStartNew).toHaveBeenCalledTimes(1)
  })

  it('renders month and day bands from entity data', () => {
    mockEntities = [
      makeEntity({ id: 'e1', name: 'Alpha Note', createdAt: '2026-09-08T12:00:00' }),
    ]
    render(<TimelineView />)
    const monthLabel = format(new Date(2026, 8, 1), 'MMMM yyyy')
    const dayLabel = format(new Date(2026, 8, 8), 'EEEE, MMMM d')
    // The month heading also carries the item-count badge, so match by substring.
    expect(screen.getByRole('heading', { name: new RegExp(monthLabel) })).toBeDefined()
    expect(screen.getByText(dayLabel)).toBeDefined()
  })

  it('shows the item count badge per month band', () => {
    mockEntities = [
      makeEntity({ id: 'e1', name: 'Alpha', createdAt: '2026-09-01T09:00:00' }),
      makeEntity({ id: 'e2', name: 'Beta', createdAt: '2026-09-08T09:00:00' }),
    ]
    render(<TimelineView />)
    expect(screen.getByText('2 items')).toBeDefined()
  })

  it('opens the editor and starts editing the entity when an entity row is clicked', () => {
    mockEntities = [makeEntity({ id: 'e1', name: 'Alpha Note' })]
    render(<TimelineView />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Alpha Note in editor' }))
    expect(mockStartEdit).toHaveBeenCalledWith('e1')
  })

  it('opens the editor and starts editing the owning entity when a claim row is clicked', () => {
    mockEntities = [
      makeEntity({ id: 'e1', name: 'Alpha Note', createdAt: '2026-09-08T12:00:00' }),
    ]
    mockClaims = [
      makeClaim({ id: 'c1', entityId: 'e1', statement: 'A testable claim' }),
    ]
    render(<TimelineView />)
    fireEvent.click(screen.getByRole('button', { name: 'Open A testable claim in editor' }))
    expect(mockStartEdit).toHaveBeenCalledWith('e1')
  })

  it('exposes semantic list structure for markers', () => {
    mockEntities = [
      makeEntity({ id: 'e1', name: 'Alpha Note', createdAt: '2026-09-08T12:00:00' }),
    ]
    const { container } = render(<TimelineView />)
    const listItems = container.querySelectorAll('li')
    // Month band, day band, and the marker itself
    expect(listItems.length).toBeGreaterThanOrEqual(3)
  })
})