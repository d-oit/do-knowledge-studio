import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from './store'
import { verifyCorpusIntegrity } from './integrity'
import { buildJsonExport, parseImportFile } from '@/components/studio/views/export-helpers'
import type { Entity, Claim } from './types'

const makeEntity = (
  id: string,
  name = `Entity ${id}`,
  links: { targetId: string; relation: string }[] = [],
): Entity => ({
  id,
  name,
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links,
})

const makeClaim = (id: string, entityId: string): Claim => ({
  id,
  entityId,
  statement: `Claim ${id}`,
  confidence: 0.9,
  verification: 'verified',
  version: 1,
  editHistory: [],
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

  it('handles bulk entity deletion atomically and cleans inbound/outbound links, claims, and selection', () => {
    const e1 = makeEntity('e1', 'E1', [{ targetId: 'e2', relation: 'link1' }, { targetId: 'e3', relation: 'link2' }])
    const e2 = makeEntity('e2', 'E2', [{ targetId: 'e1', relation: 'backlink1' }, { targetId: 'e3', relation: 'link3' }])
    const e3 = makeEntity('e3', 'E3', [{ targetId: 'e1', relation: 'backlink2' }])
    const claims = [makeClaim('c1', 'e1'), makeClaim('c2', 'e2'), makeClaim('c3', 'e3')]

    const graph = {
      nodes: [
        { id: 'e1', label: 'E1', type: 'concept' as const, x: 0, y: 0 },
        { id: 'e2', label: 'E2', type: 'concept' as const, x: 10, y: 0 },
        { id: 'e3', label: 'E3', type: 'concept' as const, x: 20, y: 0 },
      ],
      edges: [
        { id: 'g12', source: 'e1', target: 'e2', relation: 'link1' },
        { id: 'g23', source: 'e2', target: 'e3', relation: 'link3' },
      ],
    }

    useStudioStore.getState().importData([e1, e2, e3], claims, { graph })
    useStudioStore.getState().selectEntity('e1')
    useStudioStore.getState().startEdit('e1')

    // Bulk delete e1 and e2
    useStudioStore.getState().deleteEntities(['e1', 'e2'])

    const state = useStudioStore.getState()
    expect(state.entities.map((e) => e.id)).toEqual(['e3'])
    expect(state.entities[0].links).toEqual([]) // inbound links from e3 to e1 removed
    expect(state.claims.map((c) => c.id)).toEqual(['c3'])
    expect(state.graph?.nodes.map((n) => n.id)).toEqual(['e3'])
    expect(state.graph?.edges).toEqual([])
    expect(state.selectedEntityId).toBeNull()
    expect(state.editingEntityId).toBeNull()

    const report = verifyCorpusIntegrity(state)
    expect(report.valid).toBe(true)
    expect(report.issues).toEqual([])
  })

  it('export immediately after deletion and re-import round-trip produces no ghost nodes or dangling relations', () => {
    const e1 = makeEntity('e1', 'E1', [{ targetId: 'e2', relation: 'relates' }])
    const e2 = makeEntity('e2', 'E2', [{ targetId: 'e1', relation: 'backlink' }])
    const claims = [makeClaim('c1', 'e1'), makeClaim('c2', 'e2')]
    const graph = {
      nodes: [
        { id: 'e1', label: 'E1', type: 'concept' as const, x: 0, y: 0 },
        { id: 'e2', label: 'E2', type: 'concept' as const, x: 100, y: 100 },
      ],
      edges: [{ id: 'g1', source: 'e1', target: 'e2', relation: 'relates' }],
    }

    useStudioStore.getState().importData([e1, e2], claims, { graph })
    useStudioStore.getState().deleteEntity('e1')

    const currentState = useStudioStore.getState()
    // Build JSON export directly from post-deletion state
    const jsonString = buildJsonExport(currentState.entities, currentState.claims, {
      graph: currentState.graph,
      mindMap: currentState.mindMap,
      links: currentState.links,
      tags: currentState.tags,
    })

    // Parse back the exported file
    const importResult = parseImportFile(jsonString)
    expect(importResult.success).toBe(true)

    if (importResult.success) {
      useStudioStore.getState().importData(importResult.entities, importResult.claims, {
        graph: importResult.graph,
        mindMap: importResult.mindMap,
        links: importResult.links,
        tags: importResult.tags,
      })
    }

    const importedState = useStudioStore.getState()
    expect(importedState.entities.map((e) => e.id)).toEqual(['e2'])
    expect(importedState.entities[0].links).toEqual([])
    expect(importedState.claims.map((c) => c.id)).toEqual(['c2'])
    expect(importedState.graph?.nodes.map((n) => n.id)).toEqual(['e2'])
    expect(importedState.graph?.edges).toEqual([])

    const report = verifyCorpusIntegrity(importedState)
    expect(report.valid).toBe(true)
    expect(report.issues).toEqual([])
  })
})
