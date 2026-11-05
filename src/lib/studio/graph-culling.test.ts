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
  visibleRect,
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

describe('visibleRect', () => {
  const canvas = { width: 800, height: 560 }

  it('falls back to the viewBox rect without a measurement', () => {
    expect(visibleRect(canvas, 1, { x: 0, y: 0 }, null)).toEqual({
      x: -0,
      y: -0,
      width: 800,
      height: 560,
    })
    expect(visibleRect(canvas, 1, { x: 0, y: 0 }, { width: 0, height: 0 })).toEqual({
      x: -0,
      y: -0,
      width: 800,
      height: 560,
    })
  })

  it('widens the rect when the container is wider than the canvas', () => {
    // `xMidYMid meet` fits the height and letterboxes the width: 2:1 container
    // against a 1.43:1 canvas.
    const rect = visibleRect(canvas, 1, { x: 0, y: 0 }, { width: 1120, height: 560 })
    expect(rect.width).toBeCloseTo(1120)
    expect(rect.x).toBeCloseTo(-160)
    expect(rect.height).toBe(560)
  })

  it('heightens the rect when the container is taller than the canvas', () => {
    const rect = visibleRect(canvas, 1, { x: 0, y: 0 }, { width: 800, height: 1120 })
    expect(rect.height).toBeCloseTo(1120)
    expect(rect.y).toBeCloseTo(-280)
    expect(rect.width).toBe(800)
  })

  it('keeps a node that only the letterboxed region shows', () => {
    const nodes = [makeNode('letterboxed', 1000, 280)]
    const narrow = viewBoxRect(canvas, 1, { x: 0, y: 0 })
    expect(cullNodes(nodes, narrow)).toEqual([])
    const wide = visibleRect(canvas, 1, { x: 0, y: 0 }, { width: 1800, height: 560 })
    expect(cullNodes(nodes, wide)).toHaveLength(1)
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
