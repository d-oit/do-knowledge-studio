import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './context'
import type { Entity, Claim } from '@/lib/studio/types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: '1',
  name: 'Test Entity',
  type: 'concept',
  description: 'A test entity for unit testing',
  content: '',
  tags: ['test'],
  claims: [],
  links: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const NO_CLAIMS: Claim[] = []

describe('buildSystemPrompt', () => {
  it('returns base prompt when augmentation is off', () => {
    const prompt = buildSystemPrompt('test query', [], NO_CLAIMS, false)
    expect(prompt).toContain('You are assisting with a local knowledge base')
    expect(prompt).not.toContain('Relevant entities')
  })

  it('returns base prompt when no entities', () => {
    const prompt = buildSystemPrompt('test query', [], NO_CLAIMS, true)
    expect(prompt).toContain('You are assisting with a local knowledge base')
    expect(prompt).not.toContain('Relevant entities')
  })

  it('includes relevant entities when augmentation is on', () => {
    const entities = [
      makeEntity({ name: 'TypeScript', type: 'technology', description: 'A typed JavaScript' }),
      makeEntity({ id: '2', name: 'React', type: 'technology', description: 'A UI library' }),
    ]
    const prompt = buildSystemPrompt('TypeScript', entities, NO_CLAIMS, true)
    expect(prompt).toContain('Relevant entities from your library')
  })

  it('includes entity tags in prompt for matched entity results', () => {
    const entities = [
      makeEntity({ id: 'entity-ts', name: 'TypeScript Language', description: 'Strongly typed programming language', tags: ['javascript', 'compiler'] }),
    ]
    const prompt = buildSystemPrompt('TypeScript', entities, NO_CLAIMS, true)
    expect(prompt).toContain('[javascript, compiler]')
  })

  it('performs indexed entity lookup rapidly for large entity corpora', () => {
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
    expect(elapsed).toBeLessThan(50)
  })
})
