import { describe, expect, it } from 'vitest'
import {
  buildUndirectedAdjacency,
  findShortestPath,
  pathEdgeKeys,
  pathNodeNames,
  undirectedEdgeKey,
  type PwaGraphEntityLike,
} from './graph-path.js'

const graph: PwaGraphEntityLike[] = [
  { id: 'a', name: 'Alpha', links: [{ targetId: 'b', relation: 'related' }] },
  { id: 'b', name: 'Beta', links: [{ targetId: 'c', relation: 'related' }] },
  { id: 'c', name: 'Gamma', links: [] },
  { id: 'iso', name: 'Isolated', links: [] },
]

describe('graph-path', () => {
  it('normalizes undirected edge keys', () => {
    expect(undirectedEdgeKey('b', 'a')).toBe('a|b')
    expect(undirectedEdgeKey('a', 'b')).toBe('a|b')
  })

  it('builds sorted undirected adjacency', () => {
    const adjacency = buildUndirectedAdjacency(graph)
    expect(adjacency.get('a')?.map((e) => e.target)).toEqual(['b'])
    expect(adjacency.get('b')?.length).toBe(2)
  })

  it('finds the shortest path with hops', () => {
    const result = findShortestPath(graph, 'a', 'c')
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.nodeIds).toEqual(['a', 'b', 'c'])
    expect(result.edges).toEqual([
      { from: 'a', to: 'b', relation: 'related' },
      { from: 'b', to: 'c', relation: 'related' },
    ])
    expect(pathEdgeKeys(result.edges)).toEqual(new Set(['a|b', 'b|c']))
  })

  it('returns a single-node path for identical endpoints', () => {
    expect(findShortestPath(graph, 'a', 'a')).toEqual({ found: true, nodeIds: ['a'], edges: [] })
  })

  it('reports no-path for disconnected pairs', () => {
    expect(findShortestPath(graph, 'a', 'iso')).toEqual({ found: false, reason: 'no-path' })
  })

  it('reports unknown-entity for missing endpoints', () => {
    expect(findShortestPath(graph, 'a', 'ghost')).toEqual({ found: false, reason: 'unknown-entity' })
  })

  it('terminates on cycles', () => {
    const cyclic: PwaGraphEntityLike[] = [
      { id: 'x', name: 'X', links: [{ targetId: 'y' }] },
      { id: 'y', name: 'Y', links: [{ targetId: 'x' }] },
    ]
    expect(findShortestPath(cyclic, 'x', 'y').found).toBe(true)
  })

  it('resolves display names in path order, skipping unknown ids', () => {
    expect(pathNodeNames(graph, ['a', 'b', 'ghost'])).toEqual(['Alpha', 'Beta'])
  })
})
