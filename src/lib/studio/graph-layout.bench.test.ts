import { describe, expect, it } from 'vitest'
import { placeGraphNodes } from './graph-layout'
import { seedGraph } from './seed-data'
import type { Entity } from './types'

const GRAPH_LAYOUT_MS_CEILING = 100

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

describe('graph layout benchmark', () => {
  it('places 150 nodes efficiently within the time ceiling', () => {
    const seedEntities = seedGraph.nodes.map((node) => makeEntity(node.id))
    const unseededEntities = Array.from({ length: 140 }, (_, i) => makeEntity(`node-${i}`))
    const entities = [...seedEntities, ...unseededEntities]

    // Warmup
    for (let i = 0; i < 5; i++) {
      placeGraphNodes(entities, seedGraph.nodes)
    }

    const start = performance.now()
    const iterations = 50
    for (let i = 0; i < iterations; i++) {
      placeGraphNodes(entities, seedGraph.nodes)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(GRAPH_LAYOUT_MS_CEILING)
  })
})
