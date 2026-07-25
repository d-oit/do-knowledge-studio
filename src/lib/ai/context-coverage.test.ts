import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildMessages } from './context'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ChatMessage } from './types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'e-1',
    name: 'React Hooks',
    type: 'concept',
    description: 'Functions that let you use state and lifecycle in function components',
    content: 'useState, useEffect, useCallback',
    tags: ['react', 'hooks'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    links: [],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'c-1',
    entityId: 'e-1',
    statement: 'React hooks replace class components',
    confidence: 0.9,
    verification: 'verified',
    ...overrides,
  }
}

describe('AI context coverage', () => {
  it('buildSystemPrompt returns base prompt for empty entities', () => {
    const prompt = buildSystemPrompt('test query', [], [], true)
    expect(prompt).toContain('local knowledge base')
    expect(prompt).not.toContain('Relevant entities')
  })

  it('buildSystemPrompt includes entity context when augmentWithLocal is true', () => {
    const prompt = buildSystemPrompt('React hooks', [makeEntity()], [makeClaim()], true)
    expect(prompt).toContain('Relevant entities')
    expect(prompt).toContain('React Hooks')
  })

  it('buildSystemPrompt skips entity context when augmentWithLocal is false', () => {
    const prompt = buildSystemPrompt('React hooks', [makeEntity()], [makeClaim()], false)
    expect(prompt).not.toContain('Relevant entities')
  })

  it('buildSystemPrompt includes research results when provided', () => {
    const researchResults = [{
      url: 'https://example.com',
      title: 'Example',
      content: 'Some content about React hooks',
      success: true,
    }]
    const prompt = buildSystemPrompt('hooks', [makeEntity()], [], false, researchResults)
    expect(prompt).toContain('fetched web content')
  })

  it('buildSystemPrompt handles empty research results', () => {
    const prompt = buildSystemPrompt('test', [makeEntity()], [], true, [])
    expect(prompt).toContain('local knowledge base')
  })

  it('buildMessages returns array with system and user messages', () => {
    const messages = buildMessages([], 'Hello', [makeEntity()], [makeClaim()], true)
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages[messages.length - 1].role).toBe('user')
    expect(messages[messages.length - 1].content).toBe('Hello')
  })

  it('buildMessages includes chat history', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Previous question', timestamp: '2026-01-01T00:00:00Z' },
      { id: '2', role: 'assistant', content: 'Previous answer', timestamp: '2026-01-01T00:00:01Z' },
    ]
    const messages = buildMessages(history, 'New question', [makeEntity()], [], true)
    expect(messages.length).toBeGreaterThanOrEqual(4)
  })
})
