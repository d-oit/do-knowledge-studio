import { describe, it, expect } from 'vitest'
import {
  BASE_BAND_ASPECT,
  BASE_BAND_CAPACITY,
  BASE_PLACEMENT_BAND,
  BAND_ASPECT_MULTIPLIER_MAX,
  BAND_ASPECT_MULTIPLIER_MIN,
  baseNodePosition,
  placeGraphNodes,
  placementBand,
  resolveNodePosition,
  seededRandom,
  CLICK_SAFE_NODE_DISTANCE_PX,
  PREFERRED_NODE_DISTANCE_PX,
  PLACEMENT_X_MAX,
  PLACEMENT_X_MIN,
  PLACEMENT_Y_MAX,
  PLACEMENT_Y_MIN,
  type PlacementBand,
  type ViewportSize,
} from './graph-layout'
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

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/** A phone and a wide display — the two shapes the band reshapes itself to. */
const NARROW_VIEWPORT: ViewportSize = { width: 375, height: 667 }
const WIDE_VIEWPORT: ViewportSize = { width: 1920, height: 1080 }

/** Width ÷ height of a band. */
const bandAspect = (band: PlacementBand): number =>
  (band.xMax - band.xMin) / (band.yMax - band.yMin)

/** Square pixels of a band — the quantity that holds the click-safe capacity. */
const bandArea = (band: PlacementBand): number =>
  (band.xMax - band.xMin) * (band.yMax - band.yMin)

/** Every pair of `nodes` closer than click-safe, described for the failure message. */
const tooClosePairs = (nodes: readonly GraphNode[]): string[] => {
  const tooClose: string[] = []
  for (const a of nodes) {
    for (const b of nodes) {
      if (a.id >= b.id) continue
      const gap = distance(a, b)
      if (gap < CLICK_SAFE_NODE_DISTANCE_PX) {
        tooClose.push(`${a.label} ↔ ${b.label}: ${gap.toFixed(1)}px`)
      }
    }
  }
  return tooClose
}

describe('seededRandom', () => {
  it('is deterministic and stays in [0, 1)', () => {
    expect(seededRandom('e1:x')).toBe(seededRandom('e1:x'))
    expect(seededRandom('e1:x')).not.toBe(seededRandom('e1:y'))
    for (const seed of ['e1:x', 'e2:y', '0f8fad5b-d9cb-469f-a165-70867728950e:x']) {
      const value = seededRandom(seed)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('baseNodePosition', () => {
  it('stays inside the placement band', () => {
    const position = baseNodePosition('e-new')
    expect(position.x).toBeGreaterThanOrEqual(PLACEMENT_X_MIN)
    expect(position.x).toBeLessThanOrEqual(PLACEMENT_X_MAX)
    expect(position.y).toBeGreaterThanOrEqual(PLACEMENT_Y_MIN)
    expect(position.y).toBeLessThanOrEqual(PLACEMENT_Y_MAX)
  })
})

describe('resolveNodePosition', () => {
  it('returns the base position when nothing is placed', () => {
    expect(resolveNodePosition('e-new', [])).toEqual(baseNodePosition('e-new'))
  })

  it('is deterministic', () => {
    const placed = [{ x: 400, y: 300 }]
    expect(resolveNodePosition('e-new', placed)).toEqual(resolveNodePosition('e-new', placed))
  })

  it('moves a node off an occupied position and keeps its distance', () => {
    const base = baseNodePosition('e-new')
    const resolved = resolveNodePosition('e-new', [base])
    expect(resolved).not.toEqual(base)
    expect(distance(resolved, base)).toBeGreaterThanOrEqual(PREFERRED_NODE_DISTANCE_PX)
  })

  it('clears every placed node, including a seed label that would cover its dot', () => {
    // "40 Inventive Principles" is the seed node whose label intercepted the
    // click in the editor-mentions E2E flake (plans/148).
    const interceptor = seedGraph.nodes.find((node) => node.label === '40 Inventive Principles')
    expect(interceptor).toBeDefined()
    const placed = interceptor ? [{ x: interceptor.x, y: interceptor.y }] : []

    for (let i = 0; i < 200; i += 1) {
      const id = `0f8fad5b-d9cb-469f-a165-${i.toString().padStart(12, '0')}`
      const resolved = resolveNodePosition(id, placed)
      for (const node of placed) {
        expect(distance(resolved, node)).toBeGreaterThanOrEqual(PREFERRED_NODE_DISTANCE_PX)
      }
    }
  })

  it('keeps the most clearance available when the canvas is saturated', () => {
    const saturated: { x: number; y: number }[] = []
    for (let x = PLACEMENT_X_MIN; x <= PLACEMENT_X_MAX; x += 20) {
      for (let y = PLACEMENT_Y_MIN; y <= PLACEMENT_Y_MAX; y += 20) {
        saturated.push({ x, y })
      }
    }

    const clearanceOf = (position: { x: number; y: number }): number =>
      Math.min(...saturated.map((node) => distance(position, node)))

    // No position is free, so the probe must not return something worse than the
    // hash-derived point it started from.
    expect(clearanceOf(resolveNodePosition('e-new', saturated))).toBeGreaterThanOrEqual(
      clearanceOf(baseNodePosition('e-new')),
    )
  })
})

describe('placementBand', () => {
  it('is the authored band while the library fits it', () => {
    expect(placementBand(1)).toEqual(BASE_PLACEMENT_BAND)
    expect(placementBand(BASE_BAND_CAPACITY)).toEqual(BASE_PLACEMENT_BAND)
  })

  it('grows monotonically with the number of unseeded nodes', () => {
    let previous = placementBand(0)
    for (const count of [1, 7, 13, 25, 49, 100]) {
      const band = placementBand(count)
      expect(band.xMax).toBeGreaterThanOrEqual(previous.xMax)
      expect(band.yMax).toBeGreaterThanOrEqual(previous.yMax)
      previous = band
    }
    // Growth is real, not just monotonic: 100 nodes cannot share the base band.
    expect(placementBand(100).xMax).toBeGreaterThan(BASE_PLACEMENT_BAND.xMax)
  })

  it('is deterministic and keeps the band anchored at its origin', () => {
    expect(placementBand(20)).toEqual(placementBand(20))
    expect(placementBand(20).xMin).toBe(BASE_PLACEMENT_BAND.xMin)
    expect(placementBand(20).yMin).toBe(BASE_PLACEMENT_BAND.yMin)
  })
})

describe('placementBand viewport shaping', () => {
  it('returns the authored band, bit for bit, when no viewport is measured', () => {
    // SSR, the first paint, and jsdom all land here, so these are pinned
    // literals rather than `600 * Math.SQRT2`-style expressions: the reshape
    // below round-trips through Math.sqrt, and a formula that no longer
    // reproduces the authored doubles must fail here.
    expect(placementBand(7)).toEqual({
      xMin: 100,
      yMin: 80,
      xMax: 948.5281374238571,
      yMax: 645.685424949238,
    })
    expect(placementBand(13)).toEqual({
      xMin: 100,
      yMin: 80,
      xMax: 1300.0000000000002,
      yMax: 880.0000000000002,
    })
    expect(placementBand(40)).toEqual({
      xMin: 100,
      yMin: 80,
      xMax: 1797.0562748477143,
      yMax: 1211.3708498984763,
    })
    // An element that has not been laid out yet (0×0) is the same as no
    // measurement at all, so the first frame is never a degenerate band.
    expect(placementBand(40, null)).toEqual(placementBand(40))
    expect(placementBand(40, { width: 0, height: 0 })).toEqual(placementBand(40))
  })

  it('widens the band on a wide viewport and narrows it on a phone', () => {
    const authored = placementBand(40)
    const wide = placementBand(40, WIDE_VIEWPORT)
    const narrow = placementBand(40, NARROW_VIEWPORT)

    // The aspect moves in the direction of the viewport...
    expect(bandAspect(wide)).toBeGreaterThan(bandAspect(authored))
    expect(bandAspect(narrow)).toBeLessThan(bandAspect(authored))
    expect(bandAspect(wide)).toBeGreaterThan(bandAspect(narrow))
    // ...which on the same tier means a wide, short rectangle on a wide display
    // and a tall, narrow one on a phone.
    expect(wide.xMax - wide.xMin).toBeGreaterThan(authored.xMax - authored.xMin)
    expect(wide.yMax - wide.yMin).toBeLessThan(authored.yMax - authored.yMin)
    expect(narrow.xMax - narrow.xMin).toBeLessThan(authored.xMax - authored.xMin)
    expect(narrow.yMax - narrow.yMin).toBeGreaterThan(authored.yMax - authored.yMin)
  })

  it('leaves the band AREA — the click-safe capacity — to the entity count alone', () => {
    for (const count of [1, BASE_BAND_CAPACITY, 7, 13, 25, 49, 100]) {
      const authored = bandArea(placementBand(count))
      for (const viewport of [NARROW_VIEWPORT, WIDE_VIEWPORT, { width: 800, height: 1200 }]) {
        expect(bandArea(placementBand(count, viewport))).toBeCloseTo(authored, 6)
      }
    }
  })

  it('clamps the reshape to a bounded multiplier of the authored aspect', () => {
    // A 5120×1080 window asks for ~3.2× the authored aspect; it gets the cap.
    const ultrawide = placementBand(40, { width: 5120, height: 1080 })
    expect(bandAspect(ultrawide)).toBeCloseTo(
      BASE_BAND_ASPECT * BAND_ASPECT_MULTIPLIER_MAX,
      6,
    )
    // A 500×2000 window asks for ~0.17×; it gets the floor.
    const tall = placementBand(40, { width: 500, height: 2000 })
    expect(bandAspect(tall)).toBeCloseTo(BASE_BAND_ASPECT * BAND_ASPECT_MULTIPLIER_MIN, 6)
  })

  it('keeps the reshaped band anchored at the authored origin', () => {
    const band = placementBand(13, WIDE_VIEWPORT)
    expect(band.xMin).toBe(BASE_PLACEMENT_BAND.xMin)
    expect(band.yMin).toBe(BASE_PLACEMENT_BAND.yMin)
  })
})

describe('placeGraphNodes', () => {
  it('keeps authored seed positions', () => {
    const seedNode = seedGraph.nodes[0] as GraphNode
    const entity = makeEntity(seedNode.id, { name: seedNode.label, type: seedNode.type })

    const [node] = placeGraphNodes([entity], seedGraph.nodes)
    expect(node).toEqual({ id: seedNode.id, label: seedNode.label, type: seedNode.type, x: seedNode.x, y: seedNode.y })
  })

  it('places unseeded entities clear of every seed node at click-safe spacing', () => {
    const entities = [
      ...seedGraph.nodes.map((node) => makeEntity(node.id, { name: node.label, type: node.type })),
      ...Array.from({ length: 12 }, (_, i) => makeEntity(`new-${i}`)),
    ]

    const nodes = placeGraphNodes(entities, seedGraph.nodes)
    const seedNodes = nodes.filter((node) => seedGraph.nodes.some((seed) => seed.id === node.id))
    const newNodes = nodes.filter((node) => !seedGraph.nodes.some((seed) => seed.id === node.id))

    expect(newNodes).toHaveLength(12)
    // The canvas fits roughly five nodes at the preferred spacing, so a dozen
    // new entities land on the click-safe tier — never on top of a seed label.
    for (const node of newNodes) {
      for (const seed of seedNodes) {
        expect(distance(node, seed)).toBeGreaterThanOrEqual(CLICK_SAFE_NODE_DISTANCE_PX)
      }
    }
  })

  it('uses the preferred spacing while the canvas has room', () => {
    const entities = [
      ...seedGraph.nodes.map((node) => makeEntity(node.id, { name: node.label, type: node.type })),
      ...Array.from({ length: 3 }, (_, i) => makeEntity(`new-${i}`)),
    ]

    const nodes = placeGraphNodes(entities, seedGraph.nodes)
    const seedNodes = nodes.filter((node) => seedGraph.nodes.some((seed) => seed.id === node.id))
    const newNodes = nodes.filter((node) => !seedGraph.nodes.some((seed) => seed.id === node.id))

    for (const node of newNodes) {
      for (const seed of seedNodes) {
        expect(distance(node, seed)).toBeGreaterThanOrEqual(PREFERRED_NODE_DISTANCE_PX)
      }
    }
  })

  it('does not depend on the order entities are listed in', () => {
    const entities = [makeEntity('b'), makeEntity('a'), makeEntity('c')]
    const positionsById = (nodes: GraphNode[]): Map<string, { x: number; y: number }> =>
      new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]))

    expect(positionsById(placeGraphNodes(entities, []))).toEqual(
      positionsById(placeGraphNodes([...entities].reverse(), [])),
    )
  })

  it('keeps every pair at click-safe spacing as the library grows', () => {
    const seedEntities = seedGraph.nodes.map((node) =>
      makeEntity(node.id, { name: node.label, type: node.type }),
    )
    const count = 40
    const entities = [
      ...seedEntities,
      ...Array.from({ length: count }, (_, i) => makeEntity(`new-${i}`)),
    ]

    // A node placed closer than the click-safe distance can be covered by its
    // neighbour's label, which is the wrong-entity selection plans/148 fixed. A
    // library of this size must therefore widen the canvas, not crowd it — and
    // the viewport may only reshape that canvas, never shrink its area, so no
    // viewport shape may put a pair closer than the authored one does.
    for (const viewport of [null, NARROW_VIEWPORT, WIDE_VIEWPORT]) {
      expect(tooClosePairs(placeGraphNodes(entities, seedGraph.nodes, viewport))).toEqual([])
    }
  })

  it('moves no seed node, whatever the viewport', () => {
    const entities = [
      ...seedGraph.nodes.map((node) => makeEntity(node.id, { name: node.label, type: node.type })),
      ...Array.from({ length: 40 }, (_, i) => makeEntity(`new-${i}`)),
    ]
    const seedPositions = (nodes: GraphNode[]): { x: number; y: number }[] =>
      seedGraph.nodes.map((seed) => {
        const node = nodes.find((candidate) => candidate.id === seed.id)
        return { x: node?.x ?? Number.NaN, y: node?.y ?? Number.NaN }
      })

    const authored = seedPositions(placeGraphNodes(entities, seedGraph.nodes))
    expect(authored).toEqual(seedGraph.nodes.map((node) => ({ x: node.x, y: node.y })))
    expect(seedPositions(placeGraphNodes(entities, seedGraph.nodes, WIDE_VIEWPORT))).toEqual(authored)
    expect(seedPositions(placeGraphNodes(entities, seedGraph.nodes, NARROW_VIEWPORT))).toEqual(authored)
  })
})
