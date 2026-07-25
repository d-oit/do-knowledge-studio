import { describe, it, expect } from 'vitest'
import {
  resolveEntityConflict,
  resolveClaimConflict,
  resolveEntityConflicts,
  resolveClaimConflicts,
} from './conflict'
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
    statement: 'Test',
    confidence: 0.8,
    verification: 'verified',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

describe('resolveEntityConflict', () => {
  it('picks remote when newer', () => {
    const local = makeEntity({ name: 'Local', updatedAt: '2026-01-01T00:00:00Z' })
    const remote = makeEntity({ name: 'Remote', updatedAt: '2026-01-02T00:00:00Z' })
    expect(resolveEntityConflict(local, remote).name).toBe('Remote')
  })

  it('picks local when newer', () => {
    const local = makeEntity({ name: 'Local', updatedAt: '2026-01-03T00:00:00Z' })
    const remote = makeEntity({ name: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })
    expect(resolveEntityConflict(local, remote).name).toBe('Local')
  })
})

describe('resolveClaimConflict', () => {
  it('picks remote when newer', () => {
    const local = makeClaim({ statement: 'Local', updatedAt: '2026-01-01T00:00:00Z' })
    const remote = makeClaim({ statement: 'Remote', updatedAt: '2026-01-02T00:00:00Z' })
    expect(resolveClaimConflict(local, remote).statement).toBe('Remote')
  })
})

describe('resolveEntityConflicts', () => {
  it('merges non-overlapping entities', () => {
    const local = [makeEntity({ id: 'e1' })]
    const remote = [makeEntity({ id: 'e2' })]
    const result = resolveEntityConflicts(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
  })

  it('resolves overlapping entities by timestamp', () => {
    const local = [makeEntity({ id: 'e1', name: 'Local', updatedAt: '2026-01-01T00:00:00Z' })]
    const remote = [makeEntity({ id: 'e1', name: 'Remote', updatedAt: '2026-01-02T00:00:00Z' })]
    const result = resolveEntityConflicts(local, remote)
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].name).toBe('Remote')
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].resolution).toBe('remote')
  })
})

describe('resolveClaimConflicts', () => {
  it('merges non-overlapping claims', () => {
    const local = [makeClaim({ id: 'c1' })]
    const remote = [makeClaim({ id: 'c2' })]
    const result = resolveClaimConflicts(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
  })

  it('resolves overlapping claims by timestamp', () => {
    const local = [makeClaim({ id: 'c1', statement: 'Local', updatedAt: '2026-01-01T00:00:00Z' })]
    const remote = [makeClaim({ id: 'c1', statement: 'Remote', updatedAt: '2026-01-03T00:00:00Z' })]
    const result = resolveClaimConflicts(local, remote)
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0].statement).toBe('Remote')
  })
})
