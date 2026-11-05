import { describe, expect, it } from 'vitest'
import {
  PLACEMENT_CHUNK_SIZE,
  createPlacementRunner,
  placeGraphNodes,
} from './graph-layout'
import { seedGraph } from './seed-data'
import type { Entity } from './types'

/** Minimal entity fixture. */
const makeEntity = (id: string): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  links: [],
})

/** Corpus of `total` entities including the authored seed nodes. */
const corpus = (total: number): Entity[] => {
  const seeded = seedGraph.nodes.map((node) => makeEntity(node.id))
  const rest = Array.from({ length: Math.max(0, total - seeded.length) }, (_, i) =>
    makeEntity(`node-${i}`),
  )
  return [...seeded, ...rest]
}

describe('createPlacementRunner', () => {
  it('resolves the same positions as the single-pass placement', () => {
    const entities = corpus(120)
    const chunked = createPlacementRunner(entities, seedGraph.nodes, null, 7)
    let nodes = chunked.nodes
    expect(nodes.length).toBeLessThan(entities.length)
    while (!chunked.done) {
      nodes = chunked.placeChunk()
    }
    expect(nodes).toEqual(placeGraphNodes(entities, seedGraph.nodes))
  })

  it('places the next chunk per call and reports completion', () => {
    const entities = corpus(PLACEMENT_CHUNK_SIZE + 40)
    const runner = createPlacementRunner(entities, seedGraph.nodes)
    expect(runner.done).toBe(false)
    runner.placeChunk()
    expect(runner.done).toBe(false)
    expect(runner.nodes.length).toBeGreaterThan(seedGraph.nodes.length)
    runner.placeChunk()
    expect(runner.done).toBe(true)
    expect(runner.nodes).toHaveLength(entities.length)
  })

  it('places everything in one call when asked', () => {
    const entities = corpus(60)
    const runner = createPlacementRunner(entities, seedGraph.nodes)
    expect(runner.placeChunk(true)).toHaveLength(entities.length)
    expect(runner.done).toBe(true)
  })

  it('treats a non-positive chunk size as one node', () => {
    const entities = corpus(seedGraph.nodes.length + 3)
    const runner = createPlacementRunner(entities, seedGraph.nodes, null, 0)
    const first = runner.placeChunk()
    expect(first).toHaveLength(seedGraph.nodes.length + 1)
  })
})
