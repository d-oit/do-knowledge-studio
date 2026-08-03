import { describe, it, expect } from 'vitest'
import { search } from './retrieval'
import type { Entity, Claim } from '@/lib/studio/types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => {
  return {
    id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: 'Test Entity',
    type: 'note',
    description: 'A test entity description',
    content: '# Test\nSome content here.',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
    ...overrides,
  }
}

const makeClaim = (overrides: Partial<Claim> = {}): Claim => {
  return {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    entityId: 'e-1',
    statement: 'Test claim statement',
    confidence: 0.8,
    verification: 'unverified',
    ...overrides,
  }
}

describe('BM25 Retrieval Engine', () => {
  const entities: Entity[] = [
    makeEntity({ id: 'e1', name: 'React Hooks', description: 'React hooks are functions that let you use state in functional components', tags: ['react', 'javascript'], content: '# React Hooks\nuseState, useEffect, useContext' }),
    makeEntity({ id: 'e2', name: 'TypeScript Generics', description: 'Generics provide a way to create reusable components', tags: ['typescript', 'programming'], content: '# Generics\nType parameters for flexibility' }),
    makeEntity({ id: 'e3', name: 'CSS Grid Layout', description: 'A two-dimensional layout system for CSS', tags: ['css', 'layout'], content: '# Grid\nRows and columns for page layout' }),
  ]

  const claims: Claim[] = [
    makeClaim({ id: 'c1', entityId: 'e1', statement: 'Hooks were introduced in React 16.8', confidence: 0.95, verification: 'verified' }),
    makeClaim({ id: 'c2', entityId: 'e2', statement: 'TypeScript generics enable type-safe reuse', confidence: 0.9, verification: 'verified' }),
  ]

  it('returns results for a matching query', () => {
    const results = search(entities, claims, 'react hooks')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('e1')
  })

  it('ranks more relevant results higher', () => {
    const results = search(entities, claims, 'typescript generics')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('e2')
  })

  it('returns empty for empty query', () => {
    const results = search(entities, claims, '')
    expect(results).toHaveLength(0)
  })

  it('returns empty for no matches', () => {
    const results = search(entities, claims, 'xyznonexistent')
    expect(results).toHaveLength(0)
  })

  it('includes claims in results', () => {
    const results = search(entities, claims, 'React 16.8 hooks introduced')
    const claimResult = results.find((r) => r.type === 'claim')
    expect(claimResult).toBeDefined()
    expect(claimResult!.entityId).toBe('e1')
  })

  it('respects limit parameter', () => {
    const results = search(entities, claims, 'react', 1)
    expect(results).toHaveLength(1)
  })

  it('handles empty entities and claims', () => {
    const results = search([], [], 'test')
    expect(results).toHaveLength(0)
  })

  it('snippets are truncated', () => {
    const longEntity = makeEntity({
      id: 'e-long',
      name: 'Long',
      description: 'x'.repeat(300),
      content: 'y'.repeat(300),
      tags: [],
    })
    const results = search([longEntity], [], 'long')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet.length).toBeLessThanOrEqual(141)
  })

  it('stop words are filtered out', () => {
    const results = search(entities, claims, 'what is the how about react')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('e1')
  })

  it('handles claim with a missing or non-existent entity ID gracefully', () => {
    const claimWithMissingEntity = makeClaim({
      id: 'c-missing',
      entityId: 'e-nonexistent',
      statement: 'This refers to a missing entity ID',
    })
    const results = search(entities, [claimWithMissingEntity], 'missing entity ID')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('c-missing')
    // Should fallback to its ID or empty when parent entity name is missing
    expect(results[0].name).toBe('c-missing')
  })

  it('handles special characters in query without crashing', () => {
    const results = search(entities, claims, '!!! @@@ ### $$$ %%% ^^^ &*()_+')
    expect(results).toBeDefined()
    expect(results).toHaveLength(0)
  })

  it('performance benchmark with large dataset', () => {
    const largeEntities: Entity[] = Array.from({ length: 500 }, (_, i) =>
      makeEntity({
        id: `e-${i}`,
        name: `Entity Name ${i}`,
        description: `This is the description for entity number ${i} which discusses React, Hooks, TypeScript and CSS layouts.`,
        content: `# Content ${i}\nHere is some body content with key terms like keyword-${i % 10}.`,
        tags: [`tag-${i % 5}`, 'react', 'typescript'],
      })
    )

    const largeClaims: Claim[] = Array.from({ length: 1500 }, (_, i) =>
      makeClaim({
        id: `c-${i}`,
        entityId: `e-${i % 500}`,
        statement: `Statement about entity number ${i % 500} regarding React hooks or CSS systems.`,
        confidence: 0.9,
      })
    )

    const times: number[] = []
    const iterations = 50
    for (let k = 0; k < iterations; k++) {
      const start = performance.now()
      search(largeEntities, largeClaims, `React hooks keyword-${k % 10}`)
      const end = performance.now()
      times.push(end - start)
    }

    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const avgTime = times.reduce((sum, t) => sum + t, 0) / iterations

    console.warn("--- BENCHMARK STATISTICS ---")
    console.warn("Dataset size: 500 entities, 1500 claims")
    console.warn(`Iterations: ${iterations}`)
    console.warn(`Min execution time: ${minTime.toFixed(2)}ms`)
    console.warn(`Max execution time: ${maxTime.toFixed(2)}ms`)
    console.warn(`Average execution time: ${avgTime.toFixed(2)}ms`)
    console.warn("-----------------------------")

    expect(avgTime).toBeLessThan(1000) // loose upper bound for sanity
  })
})
