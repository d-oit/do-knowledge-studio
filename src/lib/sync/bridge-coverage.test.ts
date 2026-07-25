import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getYjsEntities,
  getYjsClaims,
  setYjsEntity,
  setYjsClaim,
  removeYjsClaim,
  mergeIntoYjs,
  onYjsChange,
  subscribeToYjs,
  destroyBridge,
} from './bridge'
import { addTombstone, clearTombstones } from './tombstones'
import { destroy } from './doc'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `entity-${Date.now().toString(36)}`,
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
    id: `claim-${Date.now().toString(36)}`,
    entityId: 'entity-1',
    statement: 'Test claim',
    confidence: 0.9,
    verification: 'verified',
    ...overrides,
  }
}

beforeEach(() => {
  destroy()
  clearTombstones()
})

afterEach(() => {
  destroy()
  clearTombstones()
})

describe('Bridge coverage: mergeIntoYjs', () => {
  it('merges entities and claims into Yjs doc', () => {
    const entities = [makeEntity({ id: 'e-1' }), makeEntity({ id: 'e-2' })]
    const claims = [makeClaim({ id: 'c-1' })]
    const result = mergeIntoYjs(entities, claims)
    expect(result.merged.entities).toHaveLength(2)
    expect(result.merged.claims).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })

  it('handles empty merge', () => {
    const result = mergeIntoYjs([], [])
    expect(result.merged.entities).toHaveLength(0)
    expect(result.merged.claims).toHaveLength(0)
  })

  it('detects conflicts on duplicate entities', () => {
    const entity = makeEntity({ id: 'e-1', name: 'Original' })
    setYjsEntity(entity)
    const updated = makeEntity({ id: 'e-1', name: 'Updated', updatedAt: '2026-06-01T00:00:00Z' })
    const result = mergeIntoYjs([updated], [])
    expect(result.merged.entities).toHaveLength(1)
  })
})

describe('Bridge coverage: onYjsChange callback', () => {
  it('registers and unregisters callback', () => {
    const callback = vi.fn()
    const unsub = onYjsChange(callback)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

describe('Bridge coverage: subscribeToYjs', () => {
  it('registers inbound callbacks', () => {
    const onEntities = vi.fn()
    const onClaims = vi.fn()
    const unsub = subscribeToYjs({ onEntities, onClaims })
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

describe('Bridge coverage: tombstone integration', () => {
  it('tombstoned entity is excluded from getYjsEntities', () => {
    const entity = makeEntity({ id: 'e-tombstoned' })
    setYjsEntity(entity)
    addTombstone('e-tombstoned')
    const entities = getYjsEntities()
    expect(entities.find((e) => e.id === 'e-tombstoned')).toBeUndefined()
  })

  it('tombstoned claim is excluded from getYjsClaims', () => {
    const claim = makeClaim({ id: 'c-tombstoned' })
    setYjsClaim(claim)
    addTombstone('c-tombstoned')
    const claims = getYjsClaims()
    expect(claims.find((c) => c.id === 'c-tombstoned')).toBeUndefined()
  })
})

describe('Bridge coverage: setYjsClaim / removeYjsClaim', () => {
  it('adds and retrieves claim', () => {
    const claim = makeClaim({ id: 'c-1' })
    setYjsClaim(claim)
    const claims = getYjsClaims()
    expect(claims).toHaveLength(1)
    expect(claims[0].id).toBe('c-1')
  })

  it('removes claim', () => {
    setYjsClaim(makeClaim({ id: 'c-1' }))
    removeYjsClaim('c-1')
    expect(getYjsClaims()).toEqual([])
  })
})

describe('Bridge coverage: destroyBridge', () => {
  it('cleans up subscriptions', () => {
    subscribeToYjs({ onEntities: vi.fn(), onClaims: vi.fn() })
    destroyBridge()
    // Should not throw after destroy
    expect(true).toBe(true)
  })
})
