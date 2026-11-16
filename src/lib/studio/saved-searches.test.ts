import { describe, it, expect } from 'vitest'
import {
  SavedSearchSchema,
  createSavedSearch,
  entityMatchesSavedSearch,
  countMatchingClaims,
  EMPTY_SAVED_SEARCH_FILTER,
} from './saved-searches'
import type { Entity, Claim } from './types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: crypto.randomUUID(),
  name: 'Test',
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  links: [],
  ...overrides,
})

describe('SavedSearchSchema', () => {
  it('validates a created collection', () => {
    const saved = createSavedSearch({ name: 'Research', query: 'ai', ...EMPTY_SAVED_SEARCH_FILTER })
    expect(SavedSearchSchema.safeParse(saved).success).toBe(true)
  })

  it('rejects an over-long query', () => {
    const result = SavedSearchSchema.safeParse({
      id: 'x',
      name: 'n',
      query: 'q'.repeat(501),
      ...EMPTY_SAVED_SEARCH_FILTER,
      createdAt: new Date().toISOString(),
    })
    expect(result.success).toBe(false)
  })
})

describe('entityMatchesSavedSearch', () => {
  it('matches everything with the empty filter', () => {
    expect(entityMatchesSavedSearch(makeEntity({ type: 'note' }), EMPTY_SAVED_SEARCH_FILTER)).toBe(true)
  })

  it('filters by type and tags', () => {
    const entity = makeEntity({ type: 'person', tags: ['research'] })
    expect(entityMatchesSavedSearch(entity, { ...EMPTY_SAVED_SEARCH_FILTER, types: ['note'] })).toBe(false)
    expect(entityMatchesSavedSearch(entity, { ...EMPTY_SAVED_SEARCH_FILTER, tags: ['research'] })).toBe(true)
    expect(entityMatchesSavedSearch(entity, { ...EMPTY_SAVED_SEARCH_FILTER, tags: ['other'] })).toBe(false)
  })

  it('filters by recency with an injected clock', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z')
    const recent = makeEntity({ updatedAt: '2026-11-14T00:00:00.000Z' })
    const old = makeEntity({ updatedAt: '2026-01-01T00:00:00.000Z' })
    const filter = { ...EMPTY_SAVED_SEARCH_FILTER, updatedWithinDays: 7 }
    expect(entityMatchesSavedSearch(recent, filter, now)).toBe(true)
    expect(entityMatchesSavedSearch(old, filter, now)).toBe(false)
  })
})

describe('countMatchingClaims', () => {
  it('counts by status and confidence', () => {
    const claims: Claim[] = [
      { id: 'c1', entityId: 'e1', statement: 's', confidence: 0.9, verification: 'verified', createdAt: '', updatedAt: '' },
      { id: 'c2', entityId: 'e1', statement: 's', confidence: 0.2, verification: 'unverified', createdAt: '', updatedAt: '' },
    ]
    expect(countMatchingClaims(claims, 'e1', { claimStatus: [], minConfidence: 0 })).toBe(2)
    expect(countMatchingClaims(claims, 'e1', { claimStatus: ['verified'], minConfidence: 0 })).toBe(1)
    expect(countMatchingClaims(claims, 'e1', { claimStatus: [], minConfidence: 0.5 })).toBe(1)
    expect(countMatchingClaims(claims, 'other', { claimStatus: [], minConfidence: 0 })).toBe(0)
  })
})
