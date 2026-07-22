import { describe, it, expect } from 'vitest'
import { search } from './retrieval'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
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

function makeClaim(overrides: Partial<Claim> = {}): Claim {
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

    const start = performance.now()
    const iterations = 10
    for (let k = 0; k < iterations; k++) {
      search(largeEntities, largeClaims, `React hooks keyword-${k % 10}`)
    }
    const end = performance.now()
    const averageTime = (end - start) / iterations
    console.log(`Average search execution time over 500 entities and 1500 claims: ${averageTime.toFixed(2)}ms`)
    expect(averageTime).toBeLessThan(1000) // loose upper bound for sanity
  })
})
