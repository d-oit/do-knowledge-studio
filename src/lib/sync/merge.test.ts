import { describe, it, expect } from 'vitest'
import { mergeEntities, mergeClaims } from './merge'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'entity-1',
    name: 'Test Entity',
    type: 'concept',
    description: 'A test entity',
    content: 'Some content',
    tags: ['tag1'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    links: [{ targetId: 'entity-2', relation: 'related_to' }],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    entityId: 'entity-1',
    statement: 'Test claim',
    confidence: 0.9,
    verification: 'verified',
    ...overrides,
  }
}

describe('mergeEntities', () => {
  it('merges disjoint entity sets', () => {
    const local = [makeEntity({ id: 'e1', name: 'Local' })]
    const remote = [makeEntity({ id: 'e2', name: 'Remote' })]
    const result = mergeEntities(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
  })

  it('keeps local entity when remote is absent', () => {
    const local = [makeEntity()]
    const result = mergeEntities(local, [])
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].name).toBe('Test Entity')
  })

  it('keeps remote entity when local is absent', () => {
    const remote = [makeEntity({ name: 'Remote Entity' })]
    const result = mergeEntities([], remote)
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].name).toBe('Remote Entity')
  })

  it('newer entity wins all fields (timestamp-based)', () => {
    const local = makeEntity({
      name: 'Local Name',
      description: 'Original Description',
      updatedAt: '2026-01-02T00:00:00Z',
    })
    const remote = makeEntity({
      name: 'Original Name',
      description: 'Remote Description',
      updatedAt: '2026-01-03T00:00:00Z',
    })
    const result = mergeEntities([local], [remote])
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].name).toBe('Original Name')
    expect(result.merged[0].description).toBe('Remote Description')
  })

  it('timestamp-based WLL for same field', () => {
    const local = makeEntity({
      name: 'Older',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const remote = makeEntity({
      name: 'Newer',
      updatedAt: '2026-01-03T00:00:00Z',
    })
    const result = mergeEntities([local], [remote])
    expect(result.merged[0].name).toBe('Newer')
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].winner).toBe('remote')
  })

  it('union of tags', () => {
    const local = makeEntity({ tags: ['a', 'b'] })
    const remote = makeEntity({ tags: ['b', 'c'] })
    const result = mergeEntities([local], [remote])
    expect(result.merged[0].tags.sort()).toEqual(['a', 'b', 'c'])
  })

  it('union of links', () => {
    const local = makeEntity({
      links: [{ targetId: 'e2', relation: 'related_to' }],
    })
    const remote = makeEntity({
      links: [{ targetId: 'e3', relation: 'depends_on' }],
    })
    const result = mergeEntities([local], [remote])
    expect(result.merged[0].links).toHaveLength(2)
  })

  it('conflicting link relation uses timestamp', () => {
    const local = makeEntity({
      links: [{ targetId: 'e2', relation: 'related_to' }],
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const remote = makeEntity({
      links: [{ targetId: 'e2', relation: 'depends_on' }],
      updatedAt: '2026-01-03T00:00:00Z',
    })
    const result = mergeEntities([local], [remote])
    expect(result.merged[0].links[0].relation).toBe('depends_on')
  })
})

describe('mergeClaims', () => {
  it('merges disjoint claim sets', () => {
    const local = [makeClaim({ id: 'c1', statement: 'Local' })]
    const remote = [makeClaim({ id: 'c2', statement: 'Remote' })]
    const result = mergeClaims(local, remote)
    expect(result.merged).toHaveLength(2)
  })

  it('field-level merge: different fields edited', () => {
    const local = makeClaim({ statement: 'Local statement' })
    const remote = makeClaim({ evidence: 'Remote evidence' })
    const result = mergeClaims([local], [remote])
    expect(result.merged[0].statement).toBe('Local statement')
    expect(result.merged[0].evidence).toBe('Remote evidence')
  })

  it('same ID defaults to local when no timestamp', () => {
    const local = makeClaim({
      statement: 'Local statement',
      confidence: 0.5,
    })
    const remote = makeClaim({
      statement: 'Remote statement',
      confidence: 0.9,
    })
    const result = mergeClaims([local], [remote])
    expect(result.merged[0].statement).toBe('Local statement')
    expect(result.merged[0].confidence).toBe(0.5)
  })
})
