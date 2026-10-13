import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyRemoteEnvelope } from './cross-tab'
import { recordDeletions, resetDeletions } from './cross-tab-tombstones'
import { useStudioStore } from './store'
import type { Claim, Entity } from './types'

const DELETE_TIMESTAMP = Date.parse('2026-01-02T00:00:00.000Z')

const makeEntity = (id: string, name: string, type: Entity['type']): Entity => ({
  id,
  name,
  type,
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const ENTITY_A = makeEntity('ent-a', 'Entity A', 'note')
const ENTITY_B = makeEntity('ent-b', 'Entity B', 'concept')
const CLAIM_A: Claim = {
  id: 'claim-a',
  entityId: 'ent-a',
  statement: 'Statement A',
  confidence: 0.9,
  verification: 'verified',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
}

beforeEach(() => {
  resetDeletions()
  useStudioStore.setState({
    entities: [],
    claims: [],
    entityHistory: [{ entities: [], claims: [] }],
    historyIndex: 0,
    graph: undefined,
    mindMap: undefined,
    links: undefined,
  })
})

afterEach(() => {
  resetDeletions()
})

describe('cross-tab canvas integrity', () => {
  it('rebases undo history after a canvas-only remote update', () => {
    useStudioStore.setState({ entities: [ENTITY_A], claims: [CLAIM_A] })
    const graph = {
      nodes: [{ id: 'ent-a', label: 'Entity A', type: 'note' as const, x: 0, y: 0 }],
      edges: [],
    }

    const applied = applyRemoteEnvelope({ entities: [ENTITY_A], claims: [CLAIM_A], graph }, 'tab-b-origin')

    const state = useStudioStore.getState()
    expect(applied).toBe(true)
    expect(state.entityHistory).toHaveLength(1)
    expect(state.entityHistory[0]?.canvas?.graph).toBe(state.graph)
  })

  it('prunes remote canvas edges when a deleted entity is merged', () => {
    const graph = {
      nodes: [
        { id: 'ent-a', label: 'Entity A', type: 'note' as const, x: 0, y: 0 },
        { id: 'ent-b', label: 'Entity B', type: 'concept' as const, x: 1, y: 1 },
      ],
      edges: [{ id: 'edge-a-b', source: 'ent-a', target: 'ent-b', relation: 'related' }],
    }
    useStudioStore.setState({
      entities: [ENTITY_A, ENTITY_B],
      claims: [],
      graph,
      entityHistory: [{ entities: [ENTITY_A, ENTITY_B], claims: [], canvas: { graph } }],
    })
    recordDeletions('entity', ['ent-b'], DELETE_TIMESTAMP)

    const applied = applyRemoteEnvelope({ entities: [ENTITY_A], claims: [], graph }, 'tab-b-origin')

    const state = useStudioStore.getState()
    expect(applied).toBe(true)
    expect(state.entities.map((entity) => entity.id)).toEqual(['ent-a'])
    expect(state.graph?.nodes.map((node) => node.id)).toEqual(['ent-a', 'ent-b'])
    expect(state.graph?.edges).toEqual([])
    expect(state.entityHistory[0]?.canvas?.graph?.edges).toEqual([])
  })
})
