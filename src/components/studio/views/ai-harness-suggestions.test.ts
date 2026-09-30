import { describe, it, expect } from 'vitest'
import { buildContextSuggestions } from './ai-harness-suggestions'
import type { Entity, Claim } from '@/lib/studio/types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'ent-1',
  name: 'Test Entity',
  type: 'concept',
  description: 'A test entity',
  content: '',
  tags: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  links: [],
  ...overrides,
})

const makeClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'claim-1',
  entityId: 'ent-1',
  statement: 'Something is true.',
  verification: 'unverified',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  version: 1,
  editHistory: [],
  ...overrides,
})

describe('buildContextSuggestions', () => {
  it('returns a fallback suggestion when the library is empty', () => {
    const suggestions = buildContextSuggestions([], [], null)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].label).toBe('How does this work?')
    expect(suggestions[0].prompt).toContain('AI Harness')
  })

  it('prioritizes the selected entity suggestion', () => {
    const suggestions = buildContextSuggestions([makeEntity({ name: 'Alpha' })], [], 'ent-1')
    expect(suggestions[0].label).toContain('Alpha')
    expect(suggestions[0].prompt).toContain('Alpha')
  })

  it('offers library summary and connection suggestions when entities exist', () => {
    const suggestions = buildContextSuggestions([makeEntity()], [], null)
    const labels = suggestions.map((s) => s.label)
    expect(labels).toContain('Summarize my library')
    expect(labels).toContain('Find connections')
  })

  it('adds a claims review suggestion when claims exist', () => {
    const suggestions = buildContextSuggestions([makeEntity()], [makeClaim()], null)
    const labels = suggestions.map((s) => s.label)
    expect(labels).toContain('Review my claims')
  })

  it('caps the number of suggestions at three', () => {
    const suggestions = buildContextSuggestions(
      [makeEntity()],
      [makeClaim(), makeClaim({ id: 'claim-2' })],
      'ent-1',
    )
    expect(suggestions.length).toBeLessThanOrEqual(3)
  })

  it('does not include selected-entity suggestion when selection is missing', () => {
    const suggestions = buildContextSuggestions([makeEntity()], [], 'missing-id')
    expect(suggestions.some((s) => s.label.startsWith('Explain'))).toBe(false)
  })
})
