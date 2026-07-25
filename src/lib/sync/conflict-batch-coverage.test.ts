import { describe, it, expect } from 'vitest'
import { resolveEntityConflicts, resolveClaimConflicts } from './conflict'
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

describe('Conflict resolution: batch entity conflicts', () => {
  it('merges entities with no conflicts', () => {
    const local = [makeEntity({ id: 'e-1' })]
    const remote = [makeEntity({ id: 'e-2' })]
    const result = resolveEntityConflicts(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
  })

  it('resolves entity conflicts by timestamp', () => {
    const local = [makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-06-01T00:00:00Z' })]
    const remote = [makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })]
    const result = resolveEntityConflicts(local, remote)
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].name).toBe('Local')
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].resolution).toBe('local')
  })

  it('handles empty arrays', () => {
    const result = resolveEntityConflicts([], [])
    expect(result.merged).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('handles local-only entities', () => {
    const local = [makeEntity({ id: 'e-1' })]
    const result = resolveEntityConflicts(local, [])
    expect(result.merged).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })

  it('handles remote-only entities', () => {
    const remote = [makeEntity({ id: 'e-1' })]
    const result = resolveEntityConflicts([], remote)
    expect(result.merged).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })
})

describe('Conflict resolution: batch claim conflicts', () => {
  it('merges claims with no conflicts', () => {
    const local = [makeClaim({ id: 'c-1' })]
    const remote = [makeClaim({ id: 'c-2' })]
    const result = resolveClaimConflicts(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
  })

  it('resolves claim conflicts by timestamp', () => {
    const local = [makeClaim({ id: 'c-1', statement: 'Local', updatedAt: '2026-06-01T00:00:00Z' })]
    const remote = [makeClaim({ id: 'c-1', statement: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })]
    const result = resolveClaimConflicts(local, remote)
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].statement).toBe('Local')
    expect(result.conflicts).toHaveLength(1)
  })

  it('handles empty arrays', () => {
    const result = resolveClaimConflicts([], [])
    expect(result.merged).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })
})
