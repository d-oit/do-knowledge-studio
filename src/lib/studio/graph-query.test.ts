import { describe, expect, it } from 'vitest'
import type { Claim, Entity } from './types'
import {
  EMPTY_GRAPH_FILTER,
  countActiveFilterFacets,
  filterGraph,
  findShortestPath,
  isGraphFilterActive,
  pathEdgeKeys,
  pathNodeNames,
  undirectedEdgeKey,
} from './graph-query'

/** Minimal entity with overridable identity and links. */
const makeEntity = (
  id: string,
  overrides: Partial<Entity> = {},
): Entity => ({
  id,
  name: id.toUpperCase(),
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

/** Minimal claim attached to an entity. */
const makeClaim = (id: string, entityId: string, overrides: Partial<Claim> = {}): Claim => ({
  id,
  entityId,
  statement: `claim ${id}`,
  confidence: 0.5,
  verification: 'unverified',
  ...overrides,
})

describe('findShortestPath', () => {
  it('returns the direct connection between adjacent entities', () => {
    const entities = [makeEntity('a', { links: [{ targetId: 'b', relation: 'cites' }] }), makeEntity('b')]
    const result = findShortestPath(entities, 'a', 'b')
    expect(result).toEqual({
      found: true,
      nodeIds: ['a', 'b'],
      edges: [{ from: 'a', to: 'b', relation: 'cites' }],
    })
  })

  it('prefers the shortest route when both a direct and a longer link exist', () => {
    const entities = [
      makeEntity('a', {
        links: [
          { targetId: 'c', relation: 'related' },
          { targetId: 'b', relation: 'cites' },
        ],
      }),
      makeEntity('b'),
      makeEntity('c', { links: [{ targetId: 'b', relation: 'related' }] }),
    ]
    const result = findShortestPath(entities, 'a', 'b')
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.nodeIds).toEqual(['a', 'b'])
  })

  it('traverses connections in both directions', () => {
    const entities = [
      makeEntity('a'),
      makeEntity('b', { links: [{ targetId: 'a', relation: 'mentions' }] }),
    ]
    const result = findShortestPath(entities, 'a', 'b')
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.nodeIds).toEqual(['a', 'b'])
    expect(result.edges).toEqual([{ from: 'a', to: 'b', relation: 'mentions' }])
  })

  it('walks a multi-hop chain in order', () => {
    const entities = [
      makeEntity('a', { links: [{ targetId: 'b', relation: 'one' }] }),
      makeEntity('b', { links: [{ targetId: 'c', relation: 'two' }] }),
      makeEntity('c', { links: [{ targetId: 'd', relation: 'three' }] }),
      makeEntity('d'),
    ]
    const result = findShortestPath(entities, 'a', 'd')
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.nodeIds).toEqual(['a', 'b', 'c', 'd'])
    expect(result.edges.map((edge) => edge.relation)).toEqual(['one', 'two', 'three'])
  })

  it('terminates on a cycle without looping', () => {
    // A four-cycle: the only ways from a to c are through b or through d, so
    // a BFS that fails to track visited nodes never returns.
    const entities = [
      makeEntity('a', { links: [{ targetId: 'b', relation: 'r' }] }),
      makeEntity('b', { links: [{ targetId: 'c', relation: 'r' }] }),
      makeEntity('c', { links: [{ targetId: 'd', relation: 'r' }] }),
      makeEntity('d', { links: [{ targetId: 'a', relation: 'r' }] }),
    ]
    const result = findShortestPath(entities, 'a', 'c')
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.nodeIds).toEqual(['a', 'b', 'c'])
  })

  it('reports no-path for disconnected entities', () => {
    const entities = [makeEntity('a'), makeEntity('b')]
    expect(findShortestPath(entities, 'a', 'b')).toEqual({ found: false, reason: 'no-path' })
  })

  it('reports unknown-entity when either endpoint is missing', () => {
    const entities = [makeEntity('a')]
    expect(findShortestPath(entities, 'a', 'ghost')).toEqual({
      found: false,
      reason: 'unknown-entity',
    })
    expect(findShortestPath(entities, 'ghost', 'a')).toEqual({
      found: false,
      reason: 'unknown-entity',
    })
  })

  it('returns a single-node path for an entity to itself', () => {
    expect(findShortestPath([makeEntity('a')], 'a', 'a')).toEqual({
      found: true,
      nodeIds: ['a'],
      edges: [],
    })
  })

  it('ignores links pointing at entities that are not in the corpus', () => {
    const entities = [
      makeEntity('a', { links: [{ targetId: 'deleted', relation: 'cites' }] }),
      makeEntity('b'),
    ]
    expect(findShortestPath(entities, 'a', 'b')).toEqual({ found: false, reason: 'no-path' })
  })
})

describe('path helpers', () => {
  it('resolves display names in path order', () => {
    const entities = [
      makeEntity('a', { name: 'Alpha', links: [{ targetId: 'b', relation: 'r' }] }),
      makeEntity('b', { name: 'Beta' }),
    ]
    const result = findShortestPath(entities, 'a', 'b')
    if (!result.found) throw new Error('expected a path')
    expect(pathNodeNames(entities, result.nodeIds)).toEqual(['Alpha', 'Beta'])
  })

  it('keys edges without regard to direction', () => {
    expect(undirectedEdgeKey('a', 'b')).toBe(undirectedEdgeKey('b', 'a'))
    const keys = pathEdgeKeys([{ from: 'b', to: 'a', relation: 'r' }])
    expect(keys.has(undirectedEdgeKey('a', 'b'))).toBe(true)
  })
})

describe('filterGraph', () => {
  const entities = [
    makeEntity('a', {
      type: 'concept',
      tags: ['graph'],
      updatedAt: '2026-03-01T00:00:00.000Z',
      links: [{ targetId: 'b', relation: 'cites' }],
    }),
    makeEntity('b', {
      type: 'person',
      tags: ['people'],
      updatedAt: '2026-04-01T00:00:00.000Z',
      links: [{ targetId: 'a', relation: 'mentions' }],
    }),
    makeEntity('c', {
      type: 'note',
      tags: ['graph'],
      updatedAt: '2026-02-01T00:00:00.000Z',
      links: [{ targetId: 'a', relation: 'supports' }],
    }),
  ]
  const claims = [
    makeClaim('c1', 'a', { verification: 'verified', confidence: 0.9 }),
    makeClaim('c2', 'b', { verification: 'unverified', confidence: 0.4 }),
    makeClaim('c3', 'c', { verification: 'verified', confidence: 0.6 }),
  ]

  it('passes everything through when no facet is set', () => {
    const result = filterGraph(entities, claims, EMPTY_GRAPH_FILTER)
    expect(result.entities.map((entity) => entity.id)).toEqual(['a', 'b', 'c'])
    expect(result.claims).toHaveLength(3)
    expect(result.edges).toHaveLength(3)
  })

  it('keeps only the selected entity types', () => {
    const result = filterGraph(entities, claims, { ...EMPTY_GRAPH_FILTER, types: ['concept'] })
    expect(result.entities.map((entity) => entity.id)).toEqual(['a'])
    expect(result.edges).toEqual([])
  })

  it('keeps entities carrying any selected tag', () => {
    const result = filterGraph(entities, claims, { ...EMPTY_GRAPH_FILTER, tags: ['people'] })
    expect(result.entities.map((entity) => entity.id)).toEqual(['b'])
  })

  it('drops edges whose relation is filtered out', () => {
    const result = filterGraph(entities, claims, { ...EMPTY_GRAPH_FILTER, relations: ['cites'] })
    expect(result.edges.map((edge) => edge.relation)).toEqual(['cites'])
    expect(result.entities).toHaveLength(3)
  })

  it('keeps only entities with a verified claim when verifiedOnly is set', () => {
    const result = filterGraph(entities, claims, { ...EMPTY_GRAPH_FILTER, verifiedOnly: true })
    expect(result.entities.map((entity) => entity.id)).toEqual(['a', 'c'])
    expect(result.claims.map((claim) => claim.id)).toEqual(['c1', 'c3'])
  })

  it('keeps only entities with a high-confidence claim', () => {
    const result = filterGraph(entities, claims, { ...EMPTY_GRAPH_FILTER, minConfidence: 0.8 })
    expect(result.entities.map((entity) => entity.id)).toEqual(['a'])
  })

  it('applies the date range inclusively on updatedAt', () => {
    const result = filterGraph(entities, claims, {
      ...EMPTY_GRAPH_FILTER,
      updatedAfter: '2026-03-01',
      updatedBefore: '2026-04-01',
    })
    expect(result.entities.map((entity) => entity.id)).toEqual(['a', 'b'])
  })

  it('reports activity and facet counts', () => {
    expect(isGraphFilterActive(EMPTY_GRAPH_FILTER)).toBe(false)
    expect(countActiveFilterFacets(EMPTY_GRAPH_FILTER)).toBe(0)
    const active = { ...EMPTY_GRAPH_FILTER, types: ['note'], verifiedOnly: true }
    expect(isGraphFilterActive(active)).toBe(true)
    expect(countActiveFilterFacets(active)).toBe(2)
  })
})
