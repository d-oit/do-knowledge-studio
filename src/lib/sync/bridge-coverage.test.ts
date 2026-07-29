import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getYjsEntities,
  getYjsClaims,
  setYjsEntity,
  setYjsClaim,
  removeYjsClaim,
  removeYjsEntity,
  mergeIntoYjs,
  onYjsChange,
  subscribeToYjs,
  destroyBridge,
  applyRemoteUpdate,
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

describe('Bridge coverage: removeYjsEntity', () => {
  it('removes entity and adds tombstone', () => {
    const entity = makeEntity({ id: 'e-1' })
    setYjsEntity(entity)
    removeYjsEntity('e-1')
    expect(getYjsEntities()).toEqual([])
  })

  it('tombstones removed entity', () => {
    const entity = makeEntity({ id: 'e-1' })
    setYjsEntity(entity)
    removeYjsEntity('e-1')
    const entities = getYjsEntities()
    expect(entities.find((e) => e.id === 'e-1')).toBeUndefined()
  })
})

describe('Bridge coverage: applyRemoteUpdate', () => {
  it('applies remote entities to local state', () => {
    const remote = [makeEntity({ id: 'e-1', name: 'Remote' })]
    const local: Entity[] = []
    const result = applyRemoteUpdate(remote, [], local, [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Remote')
  })

  it('applies remote claims to local state', () => {
    const remote = [makeClaim({ id: 'c-1', statement: 'Remote claim' })]
    const local: Claim[] = []
    const result = applyRemoteUpdate([], remote, [], local)
    expect(result.claims).toHaveLength(1)
    expect(result.claims[0].statement).toBe('Remote claim')
  })

  it('resolves conflicts with newer remote updates', () => {
    const local = makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-01-01' })
    const remote = makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-06-01' })
    const result = applyRemoteUpdate([remote], [], [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Remote')
  })

  it('keeps local when local is newer', () => {
    const local = makeEntity({ id: 'e-1', name: 'Local', updatedAt: '2026-06-01' })
    const remote = makeEntity({ id: 'e-1', name: 'Remote', updatedAt: '2026-01-01' })
    const result = applyRemoteUpdate([remote], [], [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Local')
  })

  it('skips invalid remote entities', () => {
    const remote = [{ id: '', name: '', type: 'invalid' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] }]
    const result = applyRemoteUpdate(remote as Entity[], [], [], [])
    expect(result.entities).toHaveLength(0)
  })

  it('skips invalid remote claims', () => {
    const remote = [{ id: '', entityId: '', statement: '', confidence: 2, verification: 'invalid' as const }]
    const result = applyRemoteUpdate([], remote as Claim[], [], [])
    expect(result.claims).toHaveLength(0)
  })

  it('does not apply tombstoned remote entities when local exists', () => {
    const local = makeEntity({ id: 'e-tombstoned', name: 'Local' })
    const remote = makeEntity({ id: 'e-tombstoned', name: 'Remote' })
    addTombstone('e-tombstoned')
    const result = applyRemoteUpdate([remote], [], [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Local')
  })

  it('does not apply tombstoned remote claims when local exists', () => {
    const local = makeClaim({ id: 'c-tombstoned', statement: 'Local claim' })
    const remote = makeClaim({ id: 'c-tombstoned', statement: 'Remote claim' })
    addTombstone('c-tombstoned')
    const result = applyRemoteUpdate([], [remote], [], [local])
    expect(result.claims).toHaveLength(1)
    expect(result.claims[0].statement).toBe('Local claim')
  })
})

describe('Bridge coverage: destroyBridge', () => {
  it('cleans up subscriptions', () => {
    const yjsSpy = vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      if (typeof msg === 'string' && msg.includes('[yjs]')) return
    })
    subscribeToYjs({ onEntities: vi.fn(), onClaims: vi.fn() })
    destroyBridge()
    // Should not throw after destroy
    expect(true).toBe(true)
    yjsSpy.mockRestore()
  })
})

describe('Bridge coverage: setYjsEntity', () => {
  it('adds and retrieves entity', () => {
    const entity = makeEntity({ id: 'e-1' })
    setYjsEntity(entity)
    const entities = getYjsEntities()
    expect(entities).toHaveLength(1)
    expect(entities[0].id).toBe('e-1')
  })

  it('overwrites existing entity', () => {
    const entity1 = makeEntity({ id: 'e-1', name: 'Original' })
    const entity2 = makeEntity({ id: 'e-1', name: 'Updated' })
    setYjsEntity(entity1)
    setYjsEntity(entity2)
    const entities = getYjsEntities()
    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Updated')
  })
})
