import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from './store'
import type { Entity } from './types'

const makeEntity = (id: string, name = `Entity ${id}`): Entity => ({
  id,
  name,
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

beforeEach(() => {
  useStudioStore.getState().resetStore()
})

describe('canvas integrity at store boundaries', () => {
  it('prunes dangling canvas edges and links at the import boundary', () => {
    const graph = {
      nodes: [
        { id: 'e1', label: 'Entity One', type: 'concept' as const, x: 0, y: 0 },
        { id: 'standalone', label: 'Standalone', type: 'concept' as const, x: 1, y: 1 },
      ],
      edges: [
        { id: 'keep', source: 'e1', target: 'e1', relation: 'self' },
        { id: 'drop', source: 'e1', target: 'missing', relation: 'dangling' },
      ],
    }
    const links = [
      { id: 'keep', sourceId: 'e1', targetId: 'e1', type: 'self', createdAt: '2026-01-01T00:00:00.000Z' },
      {
        id: 'drop',
        sourceId: 'e1',
        targetId: 'missing',
        type: 'dangling',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]

    useStudioStore.getState().importData([makeEntity('e1')], [], { graph, links })

    const state = useStudioStore.getState()
    expect(state.graph?.nodes.map((node) => node.id)).toEqual(['e1', 'standalone'])
    expect(state.graph?.edges.map((edge) => edge.id)).toEqual(['keep'])
    expect(state.links?.map((link) => link.id)).toEqual(['keep'])
    expect(state.entityHistory[0]?.canvas?.graph?.edges).toEqual(state.graph?.edges)
  })

  it('deletes canvas references with an entity and restores them on undo', () => {
    const entities = [makeEntity('e1', 'Node Alpha'), makeEntity('e2', 'Node Beta')]
    const graph = {
      nodes: [
        { id: 'e1', label: 'Node Alpha', type: 'concept' as const, x: 0, y: 0 },
        { id: 'e2', label: 'Node Beta', type: 'concept' as const, x: 120, y: 0 },
      ],
      edges: [{ id: 'g1', source: 'e1', target: 'e2', relation: 'relates' }],
    }
    const mindMap = {
      nodes: [
        { id: 'e1', label: 'Node Alpha', type: 'concept' as const },
        { id: 'e2', label: 'Node Beta', type: 'concept' as const },
      ],
      edges: [{ id: 'm1', source: 'e1', target: 'e2', relation: 'relates' }],
    }
    const links = [
      { id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'relates', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    useStudioStore.getState().importData(entities, [], { graph, mindMap, links })
    useStudioStore.getState().deleteEntity('e1')

    const deleted = useStudioStore.getState()
    expect(deleted.entities.map((entity) => entity.id)).toEqual(['e2'])
    expect(deleted.graph?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(deleted.graph?.edges).toEqual([])
    expect(deleted.mindMap?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(deleted.mindMap?.edges).toEqual([])
    expect(deleted.links).toEqual([])

    deleted.undo()

    const restored = useStudioStore.getState()
    expect(restored.graph?.nodes.map((node) => node.id)).toEqual(['e1', 'e2'])
    expect(restored.graph?.edges).toEqual(graph.edges)
    expect(restored.mindMap?.nodes.map((node) => node.id)).toEqual(['e1', 'e2'])
    expect(restored.mindMap?.edges).toEqual(mindMap.edges)
    expect(restored.links).toEqual(links)

    restored.redo()

    const redone = useStudioStore.getState()
    expect(redone.graph?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(redone.graph?.edges).toEqual([])
    expect(redone.mindMap?.nodes.map((node) => node.id)).toEqual(['e2'])
    expect(redone.mindMap?.edges).toEqual([])
    expect(redone.links).toEqual([])
  })
})
