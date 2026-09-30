import { describe, it, expect } from 'vitest'
import { buildEntityIndex, buildAdjacencyIndex } from './graph-index'
import type { Entity } from './types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: crypto.randomUUID(),
  name: 'Test Entity',
  type: 'note',
  content: 'body',
  description: 'desc',
  tags: [],
  sourceUrl: '',
  links: [],
  claims: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('buildEntityIndex', () => {
  it('returns empty Map for empty input', () => {
    const index = buildEntityIndex([])
    expect(index.size).toBe(0)
  })

  it('indexes entities by id for O(1) lookup', () => {
    const e1 = makeEntity({ id: 'a' })
    const e2 = makeEntity({ id: 'b' })
    const index = buildEntityIndex([e1, e2])

    expect(index.get('a')).toBe(e1)
    expect(index.get('b')).toBe(e2)
    expect(index.get('c')).toBeUndefined()
  })

  it('overwrites duplicates (last wins)', () => {
    const e1 = makeEntity({ id: 'a', name: 'first' })
    const e2 = makeEntity({ id: 'a', name: 'second' })
    const index = buildEntityIndex([e1, e2])
    expect(index.get('a')?.name).toBe('second')
  })
})

describe('buildAdjacencyIndex', () => {
  it('returns empty Map for empty input', () => {
    const adj = buildAdjacencyIndex([])
    expect(adj.size).toBe(0)
  })

  it('builds undirected adjacency from entity links', () => {
    const e1 = makeEntity({
      id: 'a',
      links: [{ targetId: 'b', relation: 'related' }],
    })
    const e2 = makeEntity({
      id: 'b',
      links: [{ targetId: 'c', relation: 'related' }],
    })
    const e3 = makeEntity({ id: 'c' })

    const adj = buildAdjacencyIndex([e1, e2, e3])

    // a -> b (from e1.links) and b -> a (reverse)
    expect(adj.get('a')?.has('b')).toBe(true)
    expect(adj.get('b')?.has('a')).toBe(true)

    // b -> c (from e2.links) and c -> b (reverse)
    expect(adj.get('b')?.has('c')).toBe(true)
    expect(adj.get('c')?.has('b')).toBe(true)

    // a is NOT directly connected to c
    expect(adj.get('a')?.has('c')).toBe(false)
  })

  it('handles entities with no links', () => {
    const e1 = makeEntity({ id: 'orphan' })
    const adj = buildAdjacencyIndex([e1])
    expect(adj.get('orphan')?.size).toBe(0)
  })
})
