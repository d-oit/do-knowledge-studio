import { describe, expect, it } from 'vitest'
import { pruneDanglingCanvasRefs, removeCanvasRefs, type CanvasSnapshot } from './canvas-refs'
import type { ValidatedGraph, ValidatedLink, ValidatedMindMap } from './schema'

const graph: ValidatedGraph = {
  nodes: [
    { id: 'e1', label: 'Alpha', type: 'concept', x: 0, y: 0 },
    { id: 'e2', label: 'Beta', type: 'concept', x: 1, y: 1 },
  ],
  edges: [{ id: 'g1', source: 'e1', target: 'e2', relation: 'relates' }],
}

const mindMap: ValidatedMindMap = {
  nodes: [
    { id: 'e1', label: 'Alpha', type: 'concept' },
    { id: 'e2', label: 'Beta', type: 'concept' },
  ],
  edges: [{ id: 'm1', source: 'e1', target: 'e2', relation: 'relates' }],
}

const links: ValidatedLink[] = [
  { id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'relates', createdAt: '2026-01-01T00:00:00.000Z' },
]

describe('removeCanvasRefs', () => {
  it('removes the deleted node and every edge or link that names it', () => {
    const canvas = { graph, mindMap, links }

    const result = removeCanvasRefs(canvas, 'e1')

    expect(result.graph?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(result.graph?.edges).toEqual([])
    expect(result.mindMap?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(result.mindMap?.edges).toEqual([])
    expect(result.links).toEqual([])
    expect(graph.nodes).toHaveLength(2)
  })

  it('preserves the canvas and field references when nothing matches', () => {
    const canvas = { graph, mindMap, links }

    const result = removeCanvasRefs(canvas, 'missing')

    expect(result).toBe(canvas)
    expect(result.graph).toBe(graph)
    expect(result.mindMap).toBe(mindMap)
    expect(result.links).toBe(links)
  })
  it('preserves field references that do not name the deleted id', () => {
    const untouchedGraph: ValidatedGraph = {
      nodes: [{ id: 'e2', label: 'Beta', type: 'concept', x: 1, y: 1 }],
      edges: [],
    }
    const untouchedLinks: ValidatedLink[] = [
      { id: 'l2', sourceId: 'e2', targetId: 'e2', type: 'self', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    const result = removeCanvasRefs({ graph: untouchedGraph, mindMap, links: untouchedLinks }, 'e1')

    expect(result.graph).toBe(untouchedGraph)
    expect(result.links).toBe(untouchedLinks)
    expect(result.mindMap).not.toBe(mindMap)
  })
})

describe('pruneDanglingCanvasRefs', () => {
  it('keeps self-contained nodes while dropping edges and links with missing endpoints', () => {
    const graphWithDanglingEdge: ValidatedGraph = {
      nodes: graph.nodes,
      edges: [
        graph.edges[0],
        { id: 'g2', source: 'e1', target: 'missing', relation: 'dangling' },
      ],
    }
    const mindMapWithDanglingEdge: ValidatedMindMap = {
      nodes: mindMap.nodes,
      edges: [
        mindMap.edges[0],
        { id: 'm2', source: 'missing', target: 'e2', relation: 'dangling' },
      ],
    }
    const linksWithDangling: ValidatedLink[] = [
      ...links,
      { id: 'l2', sourceId: 'e1', targetId: 'missing', type: 'dangling', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    const result = pruneDanglingCanvasRefs(
      { graph: graphWithDanglingEdge, mindMap: mindMapWithDanglingEdge, links: linksWithDangling },
      new Set(['e1', 'e2']),
    )

    expect(result.graph?.nodes).toBe(graphWithDanglingEdge.nodes)
    expect(result.graph?.edges).toEqual([graph.edges[0]])
    expect(result.mindMap?.nodes).toBe(mindMapWithDanglingEdge.nodes)
    expect(result.mindMap?.edges).toEqual([mindMap.edges[0]])
    expect(result.links).toEqual(links)
  })
  it('preserves fields that contain no dangling references', () => {
    const danglingMindMap: ValidatedMindMap = {
      nodes: mindMap.nodes,
      edges: [{ id: 'm2', source: 'e1', target: 'missing', relation: 'dangling' }],
    }

    const result = pruneDanglingCanvasRefs(
      { graph, mindMap: danglingMindMap, links },
      new Set(['e1', 'e2']),
    )

    expect(result.graph).toBe(graph)
    expect(result.links).toBe(links)
    expect(result.mindMap).not.toBe(danglingMindMap)
  })

  it('preserves all undefined fields', () => {
    const canvas: CanvasSnapshot = { graph: undefined, mindMap: undefined, links: undefined }

    const result = pruneDanglingCanvasRefs(canvas, new Set())

    expect(result).toBe(canvas)
    expect(result.graph).toBeUndefined()
    expect(result.mindMap).toBeUndefined()
    expect(result.links).toBeUndefined()
  })

  it('preserves the canvas reference when every endpoint resolves', () => {
    const canvas = { graph, mindMap, links }

    expect(pruneDanglingCanvasRefs(canvas, new Set(['e1', 'e2']))).toBe(canvas)
  })
})
