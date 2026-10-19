import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { useStudioStore } from '@/lib/studio/store'
import {
  applyConflictResolution,
  destroyBridge,
  getYjsClaims,
  getYjsEntities,
  setYjsClaim,
  setYjsEntity,
  startBidirectionalSync,
  subscribeSyncConflicts,
} from './bridge'
import { destroy, getDoc, getSyncDoc } from './doc'
import type { Claim, Entity } from '@/lib/studio/types'
import { clockFromRecord, compareClocks } from './causality'
import { getConflictResolutionKey, type FieldConflict } from './merge'
import { getTombstone, TombstoneSchema } from './tombstones'

const entity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'sync-entity',
  name: 'Local record',
  type: 'concept',
  description: 'Valid entity used by sync regression coverage',
  content: 'Content',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const resetCanonical = () => useStudioStore.setState({ entities: [], claims: [] })

afterEach(() => {
  destroyBridge()
  destroy()
  resetCanonical()
})

describe('bidirectional canonical sync', () => {
  it('propagates ordinary entity create, update, and delete mutations without Resync', () => {
    resetCanonical()
    startBidirectionalSync()
    const first = entity()
    useStudioStore.getState().commitEntity(first)
    expect(getYjsEntities()).toEqual([first])

    const updated = entity({ name: 'Updated locally', updatedAt: '2026-01-02T00:00:00.000Z' })
    useStudioStore.getState().commitEntity(updated)
    expect(getYjsEntities()).toEqual([updated])

    useStudioStore.getState().deleteEntity(first.id)
    expect(getYjsEntities()).toEqual([])

  })
  it('stops propagating canonical changes after the session unsubscribes', () => {
    resetCanonical()
    const stop = startBidirectionalSync()
    stop()
    useStudioStore.getState().commitEntity(entity())
    expect(getYjsEntities()).toEqual([])
  })

  it('propagates ordinary claim create, update, and delete mutations', () => {
    resetCanonical()
    startBidirectionalSync()
    useStudioStore.getState().addClaim({
      entityId: 'parent',
      statement: 'Initial claim',
      confidence: 0.8,
      verification: 'unverified',
    })
    const claim = useStudioStore.getState().claims[0]
    expect(getYjsClaims()).toEqual([claim])

    useStudioStore.getState().updateClaim(claim.id, { statement: 'Updated claim' })
    expect(getYjsClaims()[0]?.statement).toBe('Updated claim')

    useStudioStore.getState().deleteClaim(claim.id)
    expect(getYjsClaims()).toEqual([])
  })

  it('validates remote records and commits a valid remote transaction exactly once', () => {
    resetCanonical()
    startBidirectionalSync()
    let entityCommits = 0
    const unsubscribe = useStudioStore.subscribe((state, previous) => {
      if (state.entities !== previous.entities) entityCommits += 1
    })
    const remote = new Y.Doc()
    remote.getMap('entities').set('good', entity({ id: 'good', name: 'Remote record' }))
    remote.getMap('entities').set('bad', { id: 'bad', name: 3 })
    remote.getMap('entities').set('null', null)
    remote.getMap('entities').set('primitive', 42)
    Y.applyUpdate(getDoc(), Y.encodeStateAsUpdate(remote))

    expect(useStudioStore.getState().entities).toEqual([entity({ id: 'good', name: 'Remote record' })])
    expect(entityCommits).toBe(1)
    const remoteTombstones = new Y.Map<Record<string, unknown>>()
    remote.transact(() => {
      remote.getMap('meta').set('tombstones', remoteTombstones)
      remoteTombstones.set(JSON.stringify(['local', 'good']), {
        id: 'good',
        roomId: 'local',
        deletedAt: '2026-01-03T00:00:00.000Z',
        deletedBy: 'peer-device',
      })
    })
    Y.applyUpdate(getDoc(), Y.encodeStateAsUpdate(remote))
    expect(useStudioStore.getState().entities).toEqual([])
    expect(entityCommits).toBe(2)
    unsubscribe()
    remote.destroy()
  })

  it('commits and propagates a validated manual conflict choice', () => {
    resetCanonical()
    startBidirectionalSync()
    const local = entity({ name: 'Local choice' })
    const remote = entity({ name: 'Remote choice' })
    useStudioStore.setState({ entities: [local] })
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(getDoc()))
    const outbound: Uint8Array[] = []
    getDoc().on('update', (update) => outbound.push(update))
    const result = applyConflictResolution(
      new Map<string, 'local' | 'remote'>([[
        getConflictResolutionKey({ entityId: local.id, entityType: 'entity', field: 'name' }),
        'remote',
      ]]),
      [{
        entityId: local.id,
        entityType: 'entity',
        field: 'name',
        localValue: local.name,
        remoteValue: remote.name,
        winner: 'local',
        reason: 'manual choice',
      }],
      [local],
      [],
    )

    expect(result).toBe(true)
    for (const update of outbound) Y.applyUpdate(peer, update)
    expect(useStudioStore.getState().entities[0]?.name).toBe('Remote choice')
    expect(getYjsEntities()[0]?.name).toBe('Remote choice')
    expect(peer.getMap('entities').get('sync-entity')).toMatchObject({ name: 'Remote choice' })
    peer.destroy()
  })

  it('rejects invalid manual conflict data without changing canonical state', () => {
    resetCanonical()
    const local = entity({ name: 'Local choice' })
    useStudioStore.setState({ entities: [local] })
    const result = applyConflictResolution(
      new Map<string, 'local' | 'remote'>([[
        getConflictResolutionKey({ entityId: local.id, entityType: 'entity', field: 'name' }),
        'remote',
      ]]),
      [{
        entityId: local.id,
        entityType: 'entity',
        field: 'name',
        localValue: local.name,
        remoteValue: 42,
        winner: 'local',
        reason: 'invalid peer field',
      }],
      [local],
      [],
    )

    expect(result).toBe(false)
    expect(useStudioStore.getState().entities).toEqual([local])
  })

  it('does not apply an early deletion when a later conflict fails validation', () => {
    resetCanonical()
    const local = entity({ id: 'invalid-conflict-batch' })
    useStudioStore.setState({ entities: [local] })
    setYjsEntity(local)
    const deleteConflict: FieldConflict = {
      entityId: local.id,
      entityType: 'entity',
      field: '__delete',
      localValue: local,
      remoteValue: 'deleted',
      winner: 'local',
      reason: 'Concurrent edit and delete',
    }
    const invalidFieldConflict: FieldConflict = {
      entityId: local.id,
      entityType: 'entity',
      field: 'name',
      localValue: local.name,
      remoteValue: 42,
      winner: 'local',
      reason: 'Invalid remote field',
    }
    const resolutions = new Map<string, 'local' | 'remote'>([
      [getConflictResolutionKey(deleteConflict), 'remote'],
      [getConflictResolutionKey(invalidFieldConflict), 'remote'],
    ])

    const applied = applyConflictResolution(
      resolutions,
      [deleteConflict, invalidFieldConflict],
      [local],
      [],
    )

    expect(applied).toBe(false)
    expect(useStudioStore.getState().entities).toEqual([local])
    expect(getYjsEntities()).toEqual([local])
    expect(getTombstone(local.id)).toBeNull()
  })

  it('surfaces equal record and deletion clocks as an unresolved conflict', () => {
    resetCanonical()
    startBidirectionalSync()
    const peer = new Y.Doc()
    const shared = entity({ id: 'equal-version' })
    const sameClock = { 'peer-device': 1 }
    peer.getMap<Record<string, unknown>>('entities').set(shared.id, {
      ...shared,
      __syncClock: sameClock,
    })
    const peerTombstones = new Y.Map<Record<string, unknown>>()
    peer.getMap<unknown>('meta').set('tombstones', peerTombstones)
    peerTombstones.set(JSON.stringify(['local', 'entities', shared.id]), {
      id: shared.id,
      roomId: 'local',
      kind: 'entities',
      deletedAt: '2026-01-03T00:00:00.000Z',
      deletedBy: 'peer-device',
      clock: sameClock,
    })
    const conflicts: FieldConflict[] = []
    const unsubscribe = subscribeSyncConflicts((next) => conflicts.push(...next))

    Y.applyUpdate(getDoc(), Y.encodeStateAsUpdate(peer))

    expect(conflicts.map((conflict) => conflict.field)).toEqual(['__delete'])
    expect(useStudioStore.getState().entities).toEqual([])
    unsubscribe()
    peer.destroy()
  })

  it('commits a remote deletion choice once and forwards its dominating tombstone', () => {
    resetCanonical()
    startBidirectionalSync()
    const local = entity({ id: 'concurrent-delete' })
    useStudioStore.getState().commitEntity(local)
    const localDoc = getDoc()
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(localDoc))
    const peerEntities = peer.getMap<Record<string, unknown>>('entities')
    const baseRecord = peerEntities.get(local.id)
    if (!baseRecord) throw new Error('Expected the canonical record in the peer document')
    const baseClock = clockFromRecord(baseRecord)
    const editClock = { ...baseClock, 'edit-device': 1 }
    const deleteClock = { ...baseClock, 'delete-device': 1 }
    peerEntities.set(local.id, {
      ...baseRecord,
      name: 'Edited remotely',
      __syncClock: editClock,
    })
    const peerTombstones = new Y.Map<Record<string, unknown>>()
    peer.getMap<unknown>('meta').set('tombstones', peerTombstones)
    const tombstoneKey = JSON.stringify(['local', 'entities', local.id])
    peerTombstones.set(tombstoneKey, {
      id: local.id,
      roomId: 'local',
      kind: 'entities',
      deletedAt: '2026-01-03T00:00:00.000Z',
      deletedBy: 'delete-device',
      clock: deleteClock,
    })
    const conflicts: FieldConflict[] = []
    const unsubscribeConflicts = subscribeSyncConflicts((next) => conflicts.push(...next))

    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(peer))

    const deleteConflict = conflicts.find((conflict) => conflict.field === '__delete')
    if (!deleteConflict) throw new Error('Expected the concurrent edit/delete conflict')
    expect(useStudioStore.getState().entities).toEqual([local])

    let entityCommits = 0
    const unsubscribeStore = useStudioStore.subscribe((state, previous) => {
      if (state.entities !== previous.entities) entityCommits += 1
    })
    const forwardedUpdates: Uint8Array[] = []
    const captureUpdate = (update: Uint8Array) => { forwardedUpdates.push(update) }
    localDoc.on('update', captureUpdate)
    const applied = applyConflictResolution(
      new Map<string, 'local' | 'remote'>([[getConflictResolutionKey(deleteConflict), 'remote']]),
      [deleteConflict],
      useStudioStore.getState().entities,
      [],
    )
    localDoc.off('update', captureUpdate)

    expect(applied).toBe(true)
    expect(entityCommits).toBe(1)
    expect(useStudioStore.getState().entities).toEqual([])
    for (const update of forwardedUpdates) Y.applyUpdate(peer, update)

    const peerRecord = peerEntities.get(local.id)
    if (!peerRecord) throw new Error('Expected the record replica to remain under its tombstone')
    const peerTombstoneMap = peer.getMap<unknown>('meta').get('tombstones')
    if (!(peerTombstoneMap instanceof Y.Map)) {
      throw new Error('Expected the tombstone map to replicate to the peer')
    }
    const persistedTombstone = peerTombstoneMap.get(tombstoneKey)
    const parsedTombstone = TombstoneSchema.safeParse(persistedTombstone)
    if (!parsedTombstone.success) throw new Error('Expected the peer tombstone to validate')
    expect(compareClocks(parsedTombstone.data.clock ?? {}, clockFromRecord(peerRecord))).toBe(1)

    unsubscribeConflicts()
    unsubscribeStore()
    peer.destroy()
  })

  it('advances claim version and timestamp when restoring after a delete conflict', () => {
    resetCanonical()
    const claim: Claim = {
      id: 'claim-delete-restore',
      entityId: 'parent',
      statement: 'Restored statement',
      confidence: 0.8,
      verification: 'verified',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      version: 4,
    }
    const conflict: FieldConflict = {
      entityId: claim.id,
      entityType: 'claim',
      field: '__delete',
      localValue: claim,
      remoteValue: 'deleted',
      winner: 'local',
      reason: 'Concurrent edit and delete',
    }

    const applied = applyConflictResolution(new Map(), [conflict], [], [claim])
    const restored = useStudioStore.getState().claims[0]

    expect(applied).toBe(true)
    expect(restored?.version).toBe(5)
    expect(restored?.updatedAt).not.toBe(claim.updatedAt)
    expect(getYjsClaims()).toEqual([restored])
  })
})

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'sync-claim',
  entityId: 'parent',
  statement: 'Local claim',
  confidence: 0.8,
  verification: 'unverified',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  editHistory: [],
  ...overrides,
})

describe('causal version writes', () => {
  it('does not advance unchanged entity clocks after an unrelated entity edit', () => {
    resetCanonical()
    const unchanged = entity({ id: 'unchanged-entity' })
    const updated = entity({ id: 'updated-entity' })
    useStudioStore.setState({ entities: [unchanged, updated], claims: [] })
    setYjsEntity(unchanged)
    setYjsEntity(updated)
    startBidirectionalSync()
    const initialClock = clockFromRecord(getSyncDoc().entities.get(unchanged.id)!)

    useStudioStore.getState().commitEntity(entity({
      id: updated.id,
      name: 'Updated locally',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }))

    expect(clockFromRecord(getSyncDoc().entities.get(unchanged.id)!)).toEqual(initialClock)
  })

  it('does not advance unchanged claim clocks after an unrelated claim edit', () => {
    resetCanonical()
    const unchanged = claim({ id: 'unchanged-claim' })
    const updated = claim({ id: 'updated-claim' })
    useStudioStore.setState({ entities: [], claims: [unchanged, updated] })
    setYjsClaim(unchanged)
    setYjsClaim(updated)
    startBidirectionalSync()
    const initialClock = clockFromRecord(getSyncDoc().claims.get(unchanged.id)!)

    useStudioStore.getState().updateClaim(updated.id, { statement: 'Updated claim' })

    expect(clockFromRecord(getSyncDoc().claims.get(unchanged.id)!)).toEqual(initialClock)
  })

  it('does not advance untouched entity clocks while resolving another record', () => {
    resetCanonical()
    const affected = entity({ id: 'affected-entity', name: 'Local choice' })
    const untouched = entity({ id: 'untouched-entity' })
    useStudioStore.setState({ entities: [affected, untouched], claims: [] })
    setYjsEntity(affected)
    setYjsEntity(untouched)
    startBidirectionalSync()
    const untouchedClock = clockFromRecord(getSyncDoc().entities.get(untouched.id)!)
    const conflict = {
      entityId: affected.id,
      entityType: 'entity' as const,
      field: 'name',
      localValue: affected.name,
      remoteValue: 'Remote choice',
      winner: 'local' as const,
      reason: 'manual choice',
    }

    expect(applyConflictResolution(
      new Map<string, 'local' | 'remote'>([
        [getConflictResolutionKey(conflict), 'remote'],
      ]),
      [conflict],
      [affected, untouched],
      [],
    )).toBe(true)

    expect(clockFromRecord(getSyncDoc().entities.get(untouched.id)!)).toEqual(untouchedClock)
  })
})
