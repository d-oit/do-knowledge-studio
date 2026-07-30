import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getYjsEntities,
  getYjsClaims,
  setYjsEntity,
  setYjsClaim,
  removeYjsEntity,
  removeYjsClaim,
  applyRemoteUpdate,
  applyConflictResolution,
  startBidirectionalSync,
  destroyBridge,
  initSync,
} from './bridge'
import { addTombstone, clearTombstones } from './tombstones'
import { destroy } from './doc'
import type { Entity, Claim } from '@/lib/studio/types'

// ── Builders ──────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `bridge-e-${Date.now().toString(36)}`,
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
    id: `bridge-c-${Date.now().toString(36)}`,
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

// ── applyConflictResolution ──────────────────────────────────────────────

describe('applyConflictResolution — branch coverage', () => {
  it('applies conflict resolution for entities', () => {
    const entity = makeEntity({ id: 'e-resolve', name: 'Original', description: 'Original desc' })
    setYjsEntity(entity)

    // Add the same entity locally so collectUpdates finds it
    // applyConflictResolution uses local state passed in
    const resolutions = new Map<string, 'local' | 'remote'>()
    resolutions.set('e-resolve:name', 'remote')

    const conflicts = [{
      entityId: 'e-resolve',
      field: 'name' as const,
      entityType: 'entity' as const,
      localValue: 'Original',
      remoteValue: 'Remote Name',
      winner: 'local' as const,
      strategy: 'timestamp' as const,
    }]

    applyConflictResolution(resolutions, conflicts, [entity], [])

    // After resolution, the name should be updated to 'Remote Name'
    const entities = getYjsEntities()
    const resolved = entities.find((e) => e.id === 'e-resolve')
    expect(resolved).toBeDefined()
    expect(resolved!.name).toBe('Remote Name')
  })

  it('applies conflict resolution for claims', () => {
    const claim = makeClaim({ id: 'c-resolve', statement: 'Original claim' })
    setYjsClaim(claim)

    const resolutions = new Map<string, 'local' | 'remote'>()
    resolutions.set('c-resolve:statement', 'remote')

    const conflicts = [{
      entityId: 'c-resolve',
      field: 'statement' as const,
      entityType: 'claim' as const,
      localValue: 'Original claim',
      remoteValue: 'Updated claim',
      winner: 'local' as const,
      strategy: 'timestamp' as const,
    }]

    applyConflictResolution(resolutions, conflicts, [], [claim])

    const claims = getYjsClaims()
    const resolved = claims.find((c) => c.id === 'c-resolve')
    expect(resolved).toBeDefined()
    expect(resolved!.statement).toBe('Updated claim')
  })

  it('skips conflict resolution when resolution is "local"', () => {
    const entity = makeEntity({ id: 'e-keep-local', name: 'Local Name' })
    setYjsEntity(entity)

    const resolutions = new Map<string, 'local' | 'remote'>()
    resolutions.set('e-keep-local:name', 'local') // Keep local

    const conflicts = [{
      entityId: 'e-keep-local',
      field: 'name' as const,
      entityType: 'entity' as const,
      localValue: 'Local Name',
      remoteValue: 'Remote Name',
      winner: 'remote' as const, // would be remote if not overridden
      strategy: 'timestamp' as const,
    }]

    applyConflictResolution(resolutions, conflicts, [entity], [])

    // Name should remain 'Local Name' because resolution is 'local'
    const entities = getYjsEntities()
    const resolved = entities.find((e) => e.id === 'e-keep-local')
    expect(resolved).toBeDefined()
    expect(resolved!.name).toBe('Local Name')
  })

  it('uses winner default when resolution not in map', () => {
    const entity = makeEntity({ id: 'e-winner', name: 'Loser', updatedAt: '2026-01-01T00:00:00Z' })
    setYjsEntity(entity)

    // No resolution in map — should use conflict.winner ('local')
    const conflicts = [{
      entityId: 'e-winner',
      field: 'name' as const,
      entityType: 'entity' as const,
      localValue: 'Loser',
      remoteValue: 'Winner',
      winner: 'local' as const, // keep local
      strategy: 'timestamp' as const,
    }]

    applyConflictResolution(new Map(), conflicts, [entity], [])

    // Since winner is 'local', name stays 'Loser'
    const entities = getYjsEntities()
    expect(entities.find((e) => e.id === 'e-winner')!.name).toBe('Loser')
  })

  it('skips conflict when local entity not found', () => {
    const conflicts = [{
      entityId: 'e-nonexistent',
      field: 'name' as const,
      entityType: 'entity' as const,
      localValue: 'Local',
      remoteValue: 'Remote',
      winner: 'remote' as const,
      strategy: 'timestamp' as const,
    }]

    // Should not throw even though local entity doesn't exist
    expect(() => {
      applyConflictResolution(new Map(), conflicts, [], [])
    }).not.toThrow()
  })

  it('handles empty conflicts array', () => {
    const entity = makeEntity({ id: 'e-no-conflicts' })
    setYjsEntity(entity)

    expect(() => {
      applyConflictResolution(new Map(), [], [entity], [])
    }).not.toThrow()
  })

  it('updates updatedAt for entity resolutions', () => {
    const entity = makeEntity({ id: 'e-date', name: 'Old Name', updatedAt: '2026-01-01T00:00:00Z' })
    setYjsEntity(entity)

    const resolutions = new Map<string, 'local' | 'remote'>()
    resolutions.set('e-date:name', 'remote')

    const conflicts = [{
      entityId: 'e-date',
      field: 'name' as const,
      entityType: 'entity' as const,
      localValue: 'Old Name',
      remoteValue: 'New Name',
      winner: 'local' as const,
      strategy: 'timestamp' as const,
    }]

    applyConflictResolution(resolutions, conflicts, [entity], [])
    const entities = getYjsEntities()
    const resolved = entities.find((e) => e.id === 'e-date')
    expect(resolved).toBeDefined()
    expect(resolved!.name).toBe('New Name')
    // updatedAt should be a recent ISO string
    expect(resolved!.updatedAt).not.toBe('2026-01-01T00:00:00Z')
  })
})

// ── startBidirectionalSync ───────────────────────────────────────────────

describe('startBidirectionalSync — branch coverage', () => {
  it('starts bidirectional sync and returns unsubscribe function', () => {
    const unsub = startBidirectionalSync()
    expect(typeof unsub).toBe('function')
    unsub()
    destroyBridge()
  })

  it('returns no-op when already subscribed', () => {
    const unsub1 = startBidirectionalSync()
    const unsub2 = startBidirectionalSync() // Already subscribed
    expect(typeof unsub1).toBe('function')
    expect(typeof unsub2).toBe('function')

    // Clean up
    unsub1()
    unsub2()
    destroyBridge()
  })

  it('cleans up subscriptions on unsub', () => {
    const unsub = startBidirectionalSync()
    // Should not throw when unsubscribing
    expect(() => { unsub() }).not.toThrow()
    destroyBridge()
  })
})

// ── initSync ─────────────────────────────────────────────────────────────

describe('initSync — branch coverage', () => {
  // Skipped because initPersistence creates IndexeddbPersistence which
  // requires indexedDB (not available in JSDOM). Coverage of the initSync
  // function itself (dynamic import + initPersistence call) is tested
  // indirectly through other tests that exercise the bridge lifecycle.
  it.skip('initializes persistence via dynamic import', async () => {
    await expect(initSync()).resolves.toBeUndefined()
  })
})

// ── Empty / edge cases ───────────────────────────────────────────────────

describe('edge cases — branch coverage', () => {
  it('getYjsEntities returns empty array on empty doc', () => {
    const entities = getYjsEntities()
    expect(entities).toEqual([])
  })

  it('getYjsClaims returns empty array on empty doc', () => {
    const claims = getYjsClaims()
    expect(claims).toEqual([])
  })

  it('removeYjsEntity re-tombstones already removed entity', () => {
    const entity = makeEntity({ id: 'e-double-remove' })
    setYjsEntity(entity)
    removeYjsEntity('e-double-remove')
    // Second removal should not throw
    expect(() => removeYjsEntity('e-double-remove')).not.toThrow()
  })

  it('removeYjsClaim re-tombstones already removed claim', () => {
    const claim = makeClaim({ id: 'c-double-remove' })
    setYjsClaim(claim)
    removeYjsClaim('c-double-remove')
    expect(() => removeYjsClaim('c-double-remove')).not.toThrow()
  })

  it('mergeIntoYjs with tombstoned entity still stores it (tombstone checked at read)', () => {
    const entity = makeEntity({ id: 'e-merge-tombstone', name: 'Should appear' })
    addTombstone('e-merge-tombstone')
    setYjsEntity(entity)
    // Entity is in Yjs but tombstoned — should not appear in getYjsEntities
    const entities = getYjsEntities()
    expect(entities.find((e) => e.id === 'e-merge-tombstone')).toBeUndefined()
  })

  it('applyRemoteUpdate with empty arrays returns empty', () => {
    const result = applyRemoteUpdate([], [], [], [])
    expect(result.entities).toEqual([])
    expect(result.claims).toEqual([])
  })

  it('applyRemoteUpdate preserves local entities not in remote', () => {
    const local = makeEntity({ id: 'e-local-only', name: 'Local Only' })
    const result = applyRemoteUpdate([], [], [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Local Only')
  })

  it('applyRemoteUpdate with remote entity with no tombstone overrides local when tombstone is false', () => {
    const local = makeEntity({ id: 'e-no-tombstone', name: 'Local' })
    const remote = makeEntity({ id: 'e-no-tombstone', name: 'Remote' })
    // Not tombstoned — remote should override
    const result = applyRemoteUpdate([remote], [], [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Remote')
  })
})
