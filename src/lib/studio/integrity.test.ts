import { describe, expect, it } from 'vitest'
import { reconcileCorpusIntegrity, verifyCorpusIntegrity } from './integrity'
import type { Entity, Claim } from './types'

const makeEntity = (id: string, links: { targetId: string; relation: string }[] = []): Entity => ({
  id,
  name: `Entity ${id}`,
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
  statement: `Statement ${id}`,
  confidence: 0.9,
  verification: 'verified',
  version: 1,
  editHistory: [],
})

describe('verifyCorpusIntegrity & reconcileCorpusIntegrity', () => {
  it('identifies no issues on a clean corpus', () => {
    const entities = [makeEntity('e1', [{ targetId: 'e2', relation: 'rel' }]), makeEntity('e2')]
    const claims = [makeClaim('c1', 'e1')]
    const graph = {
      nodes: [
        { id: 'e1', label: 'E1', type: 'concept' as const, x: 0, y: 0 },
        { id: 'e2', label: 'E2', type: 'concept' as const, x: 10, y: 10 },
      ],
      edges: [{ id: 'g1', source: 'e1', target: 'e2', relation: 'rel' }],
    }
    const links = [
      { id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'rel', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    const report = verifyCorpusIntegrity({
      entities,
      claims,
      graph,
      links,
      selectedEntityId: 'e1',
      editingEntityId: 'e2',
    })

    expect(report.valid).toBe(true)
    expect(report.issues).toHaveLength(0)
  })

  it('detects and reconciles dangling claims, links, canvas edges, and selections', () => {
    const entities = [makeEntity('e1', [{ targetId: 'missing-entity', relation: 'rel' }])]
    const claims = [makeClaim('c1', 'e1'), makeClaim('c2', 'missing-entity')]
    const graph = {
      nodes: [{ id: 'e1', label: 'E1', type: 'concept' as const, x: 0, y: 0 }],
      edges: [{ id: 'g1', source: 'e1', target: 'missing-entity', relation: 'rel' }],
    }
    const links = [
      { id: 'l1', sourceId: 'e1', targetId: 'missing-entity', type: 'rel', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    const report = verifyCorpusIntegrity({
      entities,
      claims,
      graph,
      links,
      selectedEntityId: 'missing-entity',
      editingEntityId: 'missing-entity',
    })

    expect(report.valid).toBe(false)
    expect(report.issues.map((i) => i.type)).toContain('dangling_claim')
    expect(report.issues.map((i) => i.type)).toContain('dangling_entity_link')
    expect(report.issues.map((i) => i.type)).toContain('dangling_standalone_link')
    expect(report.issues.map((i) => i.type)).toContain('dangling_graph_edge')
    expect(report.issues.map((i) => i.type)).toContain('dangling_selection')
    expect(report.issues.map((i) => i.type)).toContain('dangling_editing')

    const reconciled = reconcileCorpusIntegrity({
      entities,
      claims,
      graph,
      links,
      selectedEntityId: 'missing-entity',
      editingEntityId: 'missing-entity',
    })

    const recheck = verifyCorpusIntegrity(reconciled)
    expect(recheck.valid).toBe(true)
    expect(recheck.issues).toHaveLength(0)
    expect(reconciled.entities[0].links).toHaveLength(0)
    expect(reconciled.claims).toHaveLength(1)
    expect(reconciled.graph?.edges).toHaveLength(0)
    expect(reconciled.links).toHaveLength(0)
    expect(reconciled.selectedEntityId).toBeNull()
    expect(reconciled.editingEntityId).toBeNull()
  })
})
