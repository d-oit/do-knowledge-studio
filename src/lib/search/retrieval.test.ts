import { describe, it, expect } from 'vitest'
import { search, resetSearchCache, MAX_CACHE_ENTRIES } from './retrieval'
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

  it('serves consistent results from the reference cache on repeated searches', () => {
    const first = search(entities, claims, 'react hooks')
    const second = search(entities, claims, 'react hooks')
    expect(second).toEqual(first)
    expect(second[0].id).toBe('e1')
  })

  it('rebuilds the index when entities change referentially', () => {
    const updatedEntities = [
      ...entities,
      makeEntity({
        id: 'e4',
        name: 'React Native',
        description: 'Mobile framework built on React',
        tags: ['react', 'mobile'],
        content: '# Native\nJavaScript for iOS and Android',
      }),
    ]
    const results = search(updatedEntities, claims, 'react native mobile')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.id === 'e4')).toBe(true)
    // Subsequent searches on the same reference still see the new entity.
    expect(search(updatedEntities, claims, 'native mobile').some((r) => r.id === 'e4')).toBe(true)
  })

  it('rebuilds the index when claims change referentially', () => {
    const updatedClaims = [
      ...claims,
      makeClaim({
        id: 'c3',
        entityId: 'e1',
        statement: 'Hooks compose cleanly for custom logic',
      }),
    ]
    const results = search(entities, updatedClaims, 'custom hooks compose')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.id === 'c3')).toBe(true)
  })

  it('resetSearchCache clears state and keeps results correct', () => {
    const first = search(entities, claims, 'react hooks')
    expect(first[0].id).toBe('e1')
    resetSearchCache()
    // The same references must be re-indexed cleanly after a reset.
    const second = search(entities, claims, 'react hooks')
    expect(second).toEqual(first)
    expect(second[0].id).toBe('e1')
  })

  it('searches corpora over the cache cap without errors', () => {
    const overCapEntities: Entity[] = Array.from(
      { length: MAX_CACHE_ENTRIES + 10 },
      (_, i) =>
        makeEntity({
          id: `e-${i}`,
          name: `Bulk Entity ${i}`,
          description: `bulk corpus entry number ${i} with phrase bulk-${i}`,
          content: 'x',
          tags: [],
        }),
    )
    const results = search(overCapEntities, [], 'bulk-20005')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('e-20005')
  })

  it('performance: cached queries beat cold rebuilds and stay fast as data grows', () => {
    const datasetSize = 1000
    const claimsPerEntity = 3
    const cachedIterations = 30
    const coldBuildMsCeiling = 500
    const cachedMsCeiling = 100

    const makeLargeDataset = () => {
      const largeEntities: Entity[] = Array.from({ length: datasetSize }, (_, i) =>
        makeEntity({
          id: `e-${i}`,
          name: `Entity Name ${i}`,
          description: `This is the description for entity number ${i} which discusses React, Hooks, TypeScript and CSS layouts.`,
          content: `# Content ${i}\nHere is some body content with key terms like keyword-${i % 10}.`,
          tags: [`tag-${i % 5}`, 'react', 'typescript'],
        })
      )
      const largeClaims: Claim[] = Array.from({ length: datasetSize * claimsPerEntity }, (_, i) =>
        makeClaim({
          id: `c-${i}`,
          entityId: `e-${i % datasetSize}`,
          statement: `Statement about entity number ${i % datasetSize} regarding React hooks or CSS systems.`,
          confidence: 0.9,
        })
      )
      return { largeEntities, largeClaims }
    }

    // Warm up JIT on one dataset so the measured cold build below is not skewed.
    const warm = makeLargeDataset()
    search(warm.largeEntities, warm.largeClaims, 'React hooks warmup')

    // Guarantee a true cold start regardless of state left by earlier tests.
    resetSearchCache()
    const { largeEntities, largeClaims } = makeLargeDataset()
    const coldStart = performance.now()
    search(largeEntities, largeClaims, 'React hooks keyword-3')
    const coldBuildTime = performance.now() - coldStart

    // Same references: subsequent searches must be served from the cache (hot path).
    const times: number[] = []
    for (let k = 0; k < cachedIterations; k++) {
      const start = performance.now()
      search(largeEntities, largeClaims, `React hooks keyword-${k % 10}`)
      times.push(performance.now() - start)
    }

    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const avgCached = times.reduce((sum, t) => sum + t, 0) / cachedIterations

    console.warn('--- BENCHMARK STATISTICS ---')
    console.warn(`Dataset size: ${datasetSize} entities, ${datasetSize * claimsPerEntity} claims`)
    console.warn(`Cold index build: ${coldBuildTime.toFixed(2)}ms`)
    console.warn(`Cached iterations: ${cachedIterations}`)
    console.warn(`Cached min: ${minTime.toFixed(2)}ms | max: ${maxTime.toFixed(2)}ms | avg: ${avgCached.toFixed(2)}ms`)
    console.warn('-----------------------------')

    // The cache is the point: repeated queries must never re-tokenize the corpus,
    // so a hot query must be cheaper than the one cold rebuild it avoids.
    expect(coldBuildTime).toBeLessThan(coldBuildMsCeiling)
    expect(avgCached).toBeLessThan(coldBuildTime)
    expect(avgCached).toBeLessThan(cachedMsCeiling)
  })
})
