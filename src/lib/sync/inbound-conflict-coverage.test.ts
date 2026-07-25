import { describe, it, expect } from 'vitest'
import { validateInboundEntity, validateInboundClaim } from './inbound'
import { resolveEntityConflict, resolveClaimConflict } from './conflict'
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
    links: [],
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

describe('Inbound validation: entities', () => {
  it('accepts valid entity', () => {
    const result = validateInboundEntity(makeEntity())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('entity-1')
    }
  })

  it('rejects entity with missing id', () => {
    const result = validateInboundEntity({ name: 'No ID' })
    expect(result.success).toBe(false)
  })

  it('rejects entity with empty name', () => {
    const result = validateInboundEntity(makeEntity({ name: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(validateInboundEntity(null).success).toBe(false)
    expect(validateInboundEntity('string').success).toBe(false)
    expect(validateInboundEntity(42).success).toBe(false)
  })

  it('rejects entity with invalid type', () => {
    const result = validateInboundEntity(makeEntity({ type: 'invalid' }))
    expect(result.success).toBe(false)
  })

  it('returns structured errors on failure', () => {
    const result = validateInboundEntity(makeEntity({ name: '' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toHaveProperty('path')
      expect(result.errors[0]).toHaveProperty('message')
    }
  })
})

describe('Inbound validation: claims', () => {
  it('accepts valid claim', () => {
    const result = validateInboundClaim(makeClaim())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('claim-1')
    }
  })

  it('accepts claim without timestamps (backward compat)', () => {
    const claim = makeClaim()
    delete (claim as Record<string, unknown>).createdAt
    delete (claim as Record<string, unknown>).updatedAt
    const result = validateInboundClaim(claim)
    expect(result.success).toBe(true)
  })

  it('rejects claim with missing statement', () => {
    const result = validateInboundClaim({ id: 'c-1', entityId: 'e-1' })
    expect(result.success).toBe(false)
  })

  it('rejects claim with confidence out of range', () => {
    const result = validateInboundClaim(makeClaim({ confidence: 1.5 }))
    expect(result.success).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(validateInboundClaim(null).success).toBe(false)
    expect(validateInboundClaim(undefined).success).toBe(false)
  })
})

describe('Conflict resolution: entities', () => {
  it('picks newer entity by updatedAt', () => {
    const local = makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-01-01T00:00:00Z' })
    const remote = makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-06-01T00:00:00Z' })
    const result = resolveEntityConflict(local, remote)
    expect(result.name).toBe('Remote')
  })

  it('picks remote when timestamps are equal (>= comparison)', () => {
    const local = makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-01-01T00:00:00Z' })
    const remote = makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })
    const result = resolveEntityConflict(local, remote)
    // Implementation uses >= so remote wins on equal timestamps
    expect(result.name).toBe('Remote')
  })

  it('picks local when local is newer', () => {
    const local = makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-06-01T00:00:00Z' })
    const remote = makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })
    const result = resolveEntityConflict(local, remote)
    expect(result.name).toBe('Local')
  })
})

describe('Conflict resolution: claims', () => {
  it('picks newer claim by updatedAt', () => {
    const local = makeClaim({ id: 'c-1', statement: 'Local', updatedAt: '2026-01-01T00:00:00Z' })
    const remote = makeClaim({ id: 'c-1', statement: 'Remote', updatedAt: '2026-06-01T00:00:00Z' })
    const result = resolveClaimConflict(local, remote)
    expect(result.statement).toBe('Remote')
  })

  it('picks local when local is newer', () => {
    const local = makeClaim({ id: 'c-1', statement: 'Local', updatedAt: '2026-06-01T00:00:00Z' })
    const remote = makeClaim({ id: 'c-1', statement: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })
    const result = resolveClaimConflict(local, remote)
    expect(result.statement).toBe('Local')
  })
})
