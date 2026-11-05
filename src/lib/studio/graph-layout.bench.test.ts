import { describe, expect, it } from 'vitest'
import { placeGraphNodes } from './graph-layout'
import { seedGraph } from './seed-data'
import type { Entity } from './types'

/**
 * Layout budgets (#1053). Each entry is the milliseconds allowed to place a
 * corpus of that size, measured on the CI runner with the spatial-hash
 * placement path. Numbers and method are recorded in `plans/perf-baselines.md`.
 */
const LAYOUT_BUDGETS_MS: ReadonlyArray<{ nodes: number; ceilingMs: number }> = [
  { nodes: 500, ceilingMs: 120 },
  { nodes: 2_000, ceilingMs: 500 },
  { nodes: 5_000, ceilingMs: 2_000 },
]

/** Graph shape that matters for placement cost: seed obstacles plus unseeded nodes. */
const makeEntity = (id: string): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  links: [],
})

/** Entities for a graph of `total` nodes, including the authored seed nodes. */
const buildCorpus = (total: number): Entity[] => {
  const seeded = seedGraph.nodes.map((node) => makeEntity(node.id))
  const unseeded = Array.from({ length: Math.max(0, total - seeded.length) }, (_, i) =>
    makeEntity(`node-${String(i).padStart(5, '0')}`),
  )
  return [...seeded, ...unseeded]
}

describe('graph layout benchmark', () => {
  it('places 150 nodes efficiently within the time ceiling', () => {
    const entities = buildCorpus(150)

    for (let i = 0; i < 5; i++) {
      placeGraphNodes(entities, seedGraph.nodes)
    }

    const start = performance.now()
    const iterations = 50
    for (let i = 0; i < iterations; i++) {
      placeGraphNodes(entities, seedGraph.nodes)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
  })

  it.each(LAYOUT_BUDGETS_MS)(
    'places $nodes nodes within $ceilingMs ms',
    ({ nodes, ceilingMs }) => {
      const entities = buildCorpus(nodes)

      // One warm-up pass so the measurement is not dominated by JIT compilation.
      placeGraphNodes(entities, seedGraph.nodes)

      const start = performance.now()
      const placed = placeGraphNodes(entities, seedGraph.nodes)
      const duration = performance.now() - start

      expect(placed).toHaveLength(nodes)
      // The reporter prints the measured duration next to the test name; those
      // numbers are what plans/perf-baselines.md records.
      expect(duration).toBeLessThan(ceilingMs)
    },
    30_000,
  )

  it('stays deterministic at 2k nodes', () => {
    const entities = buildCorpus(2_000)
    const first = placeGraphNodes(entities, seedGraph.nodes)
    const second = placeGraphNodes([...entities].reverse(), seedGraph.nodes)
    const key = (node: { id: string; x: number; y: number }): string =>
      `${node.id}:${node.x.toFixed(3)}:${node.y.toFixed(3)}`
    expect(new Map(first.map((node) => [node.id, key(node)]))).toEqual(
      new Map(second.map((node) => [node.id, key(node)])),
    )
  })
})
