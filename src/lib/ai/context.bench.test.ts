import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from './context'
import type { Entity, Claim } from '@/lib/studio/types'

const INDEXED_LOOKUP_MS_CEILING = 500
const NO_CLAIMS: Claim[] = []

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: '1',
  name: 'Test Entity',
  type: 'concept',
  description: 'A test entity for unit testing',
  content: '',
  tags: ['test'],
  links: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('buildSystemPrompt benchmark', () => {
  it('keeps indexed entity lookup within its smoke ceiling for large corpora', () => {
    const largeCorpus = Array.from({ length: 500 }, (_, i) =>
      makeEntity({
        id: `entity-${i}`,
        name: `Knowledge Topic ${i}`,
        description: `Detailed description for knowledge topic item number ${i} with searchable terms.`,
        tags: [`tag-${i % 10}`],
      }),
    )
    const start = performance.now()
    const prompt = buildSystemPrompt('Topic 250', largeCorpus, NO_CLAIMS, true)
    const elapsed = performance.now() - start

    expect(prompt).toContain('Topic 250')
    expect(elapsed).toBeLessThan(INDEXED_LOOKUP_MS_CEILING)
  })
})
