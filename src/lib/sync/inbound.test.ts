import { describe, it, expect } from 'vitest'
import {
  validateInboundEntity,
  validateInboundClaim,
  validateInboundEntities,
  validateInboundClaims,
} from './inbound'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'e1',
    name: 'Test',
    type: 'note',
    description: 'desc',
    content: 'body',
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    links: [],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'c1',
    entityId: 'e1',
    statement: 'Test claim',
    confidence: 0.8,
    verification: 'verified',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

describe('validateInboundEntity', () => {
  it('accepts valid entity', () => {
    const result = validateInboundEntity(makeEntity())
    expect(result.success).toBe(true)
  })

  it('rejects entity with missing id', () => {
    const result = validateInboundEntity({ ...makeEntity(), id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects entity with invalid type', () => {
    const result = validateInboundEntity({ ...makeEntity(), type: 'bogus' })
    expect(result.success).toBe(false)
  })

  it('rejects non-object input', () => {
    const result = validateInboundEntity('not an entity')
    expect(result.success).toBe(false)
  })
})

describe('validateInboundClaim', () => {
  it('accepts valid claim', () => {
    const result = validateInboundClaim(makeClaim())
    expect(result.success).toBe(true)
  })

  it('accepts claim without timestamps', () => {
    const claim = makeClaim()
    delete claim.createdAt
    delete claim.updatedAt
    const result = validateInboundClaim(claim)
    expect(result.success).toBe(true)
  })

  it('rejects claim with confidence out of range', () => {
    const result = validateInboundClaim({ ...makeClaim(), confidence: 2.0 })
    expect(result.success).toBe(false)
  })
})

describe('validateInboundEntities', () => {
  it('separates valid and rejected', () => {
    const items = [makeEntity(), { invalid: true }, makeEntity({ id: 'e2' })]
    const result = validateInboundEntities(items)
    expect(result.valid).toHaveLength(2)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0].index).toBe(1)
  })
})

describe('validateInboundClaims', () => {
  it('separates valid and rejected', () => {
    const items = [makeClaim(), { invalid: true }, makeClaim({ id: 'c2' })]
    const result = validateInboundClaims(items)
    expect(result.valid).toHaveLength(2)
    expect(result.rejected).toHaveLength(1)
  })
})
