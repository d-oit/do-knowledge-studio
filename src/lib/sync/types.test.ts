import { describe, it, expect } from 'vitest'
import {
  entityToYMap,
  ymapToEntity,
  claimToYMap,
  ymapToClaim,
  createSyncDoc,
} from './types'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'entity-1',
    name: 'Test Entity',
    type: 'concept',
    description: 'A test entity',
    content: 'Some content',
    tags: ['tag1', 'tag2'],
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

describe('createSyncDoc', () => {
  it('creates empty sync doc', () => {
    const doc = createSyncDoc()
    expect(doc.entities.size).toBe(0)
    expect(doc.claims.size).toBe(0)
    expect(doc.meta.size).toBe(0)
  })
})

describe('entityToYMap / ymapToEntity', () => {
  it('round-trips entity', () => {
    const entity = makeEntity()
    const map = entityToYMap(entity)
    const result = ymapToEntity(map)
    expect(result).toEqual(entity)
  })

  it('handles entity with no links', () => {
    const entity = makeEntity({ links: [] })
    const map = entityToYMap(entity)
    const result = ymapToEntity(map)
    expect(result.links).toEqual([])
  })

  it('handles entity with sourceUrl', () => {
    const entity = makeEntity({ sourceUrl: 'https://example.com' })
    const map = entityToYMap(entity)
    const result = ymapToEntity(map)
    expect(result.sourceUrl).toBe('https://example.com')
  })
})

describe('claimToYMap / ymapToClaim', () => {
  it('round-trips claim', () => {
    const claim = makeClaim()
    const map = claimToYMap(claim)
    const result = ymapToClaim(map)
    expect(result).toEqual(claim)
  })

  it('handles claim with optional fields', () => {
    const claim = makeClaim({ evidence: 'Some evidence', source: 'Source A' })
    const map = claimToYMap(claim)
    const result = ymapToClaim(map)
    expect(result.evidence).toBe('Some evidence')
    expect(result.source).toBe('Source A')
  })
})
