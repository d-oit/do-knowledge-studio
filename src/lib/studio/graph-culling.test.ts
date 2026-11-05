import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from './types'
import {
  CULL_MARGIN_PX,
  EDGE_LABEL_MIN_ZOOM,
  LABEL_LOD_NODE_THRESHOLD,
  LABEL_LOD_MIN_ZOOM,
  cullEdges,
  cullNodes,
  isLargeGraph,
  shouldShowNodeLabels,
  shouldShowRelationLabels,
  viewBoxRect,
} from './graph-culling'

/** Positioned node fixture. */
const makeNode = (id: string, x: number, y: number): GraphNode => ({
  id,
  label: id,
  type: 'note',
  x,
  y,
})

/** Edge fixture. */
const makeEdge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  relation: 'related',
})

describe('viewBoxRect', () => {
  it('matches the SVG viewBox maths for zoom 1 with no pan', () => {
    expect(viewBoxRect({ width: 800, height: 560 }, 1, { x: 0, y: 0 })).toEqual({
      x: -0,
      y: -0,
      width: 800,
      height: 560,
    })
  })

  it('subtracts pan and scales width/height by zoom', () => {
    expect(viewBoxRect({ width: 800, height: 560 }, 2, { x: 100, y: -40 })).toEqual({
      x: -50,
      y: 20,
      width: 400,
      height: 280,
    })
  })
})

describe('cullNodes', () => {
  const rect = { x: 0, y: 0, width: 800, height: 560 }

  it('keeps nodes inside the rectangle and drops ones outside the margin', () => {
    const nodes = [
      makeNode('inside', 400, 280),
      makeNode('edge', 800 + CULL_MARGIN_PX - 1, 280),
      makeNode('far', 800 + CULL_MARGIN_PX + 1, 280),
      makeNode('below', 400, 560 + CULL_MARGIN_PX + 50),
    ]
    expect(cullNodes(nodes, rect).map((node) => node.id)).toEqual(['inside', 'edge'])
  })

  it('keeps every node when the viewBox covers the whole canvas', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 800, 560)]
    expect(cullNodes(nodes, rect)).toHaveLength(2)
  })

  it('honours a custom margin', () => {
    const nodes = [makeNode('outside', 900, 280)]
    expect(cullNodes(nodes, rect, 0)).toEqual([])
    expect(cullNodes(nodes, rect, 200)).toHaveLength(1)
  })
})

describe('cullEdges', () => {
  const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'd')]

  it('keeps only edges whose endpoints are both drawn', () => {
    expect(cullEdges(edges, new Set(['a', 'b', 'c'])).map((edge) => edge.id)).toEqual([
      'a-b',
      'b-c',
    ])
  })

  it('returns nothing when no endpoints are drawn', () => {
    expect(cullEdges(edges, new Set())).toEqual([])
  })
})

describe('level of detail', () => {
  it('keeps node labels for small graphs at any zoom', () => {
    expect(shouldShowNodeLabels(LABEL_LOD_NODE_THRESHOLD - 1, 0.2)).toBe(true)
  })

  it('drops node labels for large graphs when zoomed out', () => {
    expect(shouldShowNodeLabels(LABEL_LOD_NODE_THRESHOLD, LABEL_LOD_MIN_ZOOM - 0.01)).toBe(false)
    expect(shouldShowNodeLabels(LABEL_LOD_NODE_THRESHOLD, LABEL_LOD_MIN_ZOOM)).toBe(true)
  })

  it('hides relation labels for large graphs below the edge-label zoom', () => {
    expect(shouldShowRelationLabels(LABEL_LOD_NODE_THRESHOLD, EDGE_LABEL_MIN_ZOOM - 0.01)).toBe(false)
    expect(shouldShowRelationLabels(50, 0.1)).toBe(true)
  })

  it('flags only graphs at or above the notice threshold', () => {
    expect(isLargeGraph(999)).toBe(false)
    expect(isLargeGraph(1000)).toBe(true)
  })
})
