import { describe, it, expect } from 'vitest'
import {
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  canvasSize,
  canvasViewBox,
} from './graph-viewport'
import { placeGraphNodes } from './graph-layout'
import { seedGraph } from './seed-data'
import type { Entity, GraphNode } from './types'

const makeEntity = (id: string, overrides: Partial<Entity> = {}): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  links: [],
  ...overrides,
})

const nodeAt = (x: number, y: number): GraphNode => ({
  id: `${x}:${y}`,
  label: 'Node',
  type: 'concept',
  x,
  y,
})

describe('canvasSize', () => {
  it('is the authored canvas while every node fits inside it', () => {
    expect(canvasSize([])).toEqual({ width: BASE_CANVAS_WIDTH, height: BASE_CANVAS_HEIGHT })
    expect(canvasSize([nodeAt(400, 300)])).toEqual({
      width: BASE_CANVAS_WIDTH,
      height: BASE_CANVAS_HEIGHT,
    })
  })

  it('grows past the authored canvas to contain a node and its label', () => {
    const size = canvasSize([nodeAt(1200, 900)])

    // Not just past the node centre: the label hangs below it and spans ±66px, so
    // a canvas that stopped at the centre would clip the text it exists to show.
    expect(size.width).toBeGreaterThan(1200)
    expect(size.height).toBeGreaterThan(900)
  })

  it('contains every node of a library too large for the authored canvas', () => {
    const entities = [
      ...seedGraph.nodes.map((node) => makeEntity(node.id, { name: node.label, type: node.type })),
      ...Array.from({ length: 40 }, (_, i) => makeEntity(`new-${i}`)),
    ]

    const nodes = placeGraphNodes(entities, seedGraph.nodes)
    const size = canvasSize(nodes)

    // The regression this guards: placement spread nodes over a grown band while
    // the viewBox stayed at 800×560, so most of the graph was drawn off-canvas.
    for (const node of nodes) {
      expect(node.x).toBeLessThan(size.width)
      expect(node.y).toBeLessThan(size.height)
    }
    expect(size.width).toBeGreaterThan(BASE_CANVAS_WIDTH)
    expect(size.height).toBeGreaterThan(BASE_CANVAS_HEIGHT)
  })
})

describe('canvasViewBox', () => {
  it('shows the whole canvas when the view is at rest', () => {
    expect(canvasViewBox({ width: 800, height: 560 }, 1, { x: 0, y: 0 })).toBe('0 0 800 560')
  })

  it('halves the visible extents at 2× zoom', () => {
    expect(canvasViewBox({ width: 800, height: 560 }, 2, { x: 0, y: 0 })).toBe('0 0 400 280')
  })

  it('subtracts pan in canvas units, so panning stays constant on screen', () => {
    expect(canvasViewBox({ width: 800, height: 560 }, 2, { x: 40, y: 20 })).toBe('-20 -10 400 280')
  })
})
