import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './context'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
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
  }
}

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
})
