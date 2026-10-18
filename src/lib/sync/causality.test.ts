import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from '@/lib/studio/store'
import type { Entity } from '@/lib/studio/types'
import { applyConflictResolution, destroyBridge, getYjsEntities, mergeIntoYjs, setYjsEntity } from './bridge'
import { clockFromRecord, compareClocks } from './causality'
import { destroy, getDoc, getSyncDoc } from './doc'
import { addTombstone, getTombstoneMap, isTombstoned } from './tombstones'

const makeEntity = (id: string, name = `Entity ${id}`): Entity => ({
  id,
  name,
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

beforeEach(() => {
  destroyBridge()
  destroy()
  useStudioStore.setState({ entities: [], claims: [] })
})

afterEach(() => {
  destroyBridge()
  destroy()
})

describe('causal record deletion', () => {
  it('suppresses a stale record after a causally later delete', () => {
    const entity = makeEntity('stale')
    setYjsEntity(entity)
    const staleRecord = getSyncDoc().entities.get(entity.id)
    addTombstone(entity.id)
    getSyncDoc().entities.set(entity.id, staleRecord!)

    expect(getYjsEntities()).toEqual([])
    expect(isTombstoned(entity.id, 'entities', clockFromRecord(staleRecord!))).toBe(true)
  })

  it('allows an explicit same-ID restore whose version observes the delete', () => {
    const entity = makeEntity('restore')
    setYjsEntity(entity)
    addTombstone(entity.id)
    setYjsEntity({ ...entity, name: 'Restored' })

    expect(getYjsEntities()).toEqual([{ ...entity, name: 'Restored' }])
    expect(compareClocks(
      clockFromRecord(getSyncDoc().entities.get(entity.id)!),
      getTombstoneMap().get(JSON.stringify(['local', 'entities', entity.id]))?.clock as Record<string, number>,
    )).toBe(1)
  })

  it('surfaces concurrent edit/delete and applies a manual restore choice', () => {
    const entity = makeEntity('concurrent')
    setYjsEntity(entity)
    const map = getSyncDoc().entities
    const raw = map.get(entity.id)!
    const baseClock = clockFromRecord(raw)
    const editClock = { ...baseClock, 'edit-device': (baseClock['edit-device'] ?? 0) + 1 }
    map.set(entity.id, { ...raw, name: 'Concurrent edit', __syncClock: editClock })
    getTombstoneMap().set(JSON.stringify(['local', 'entities', entity.id]), {
      id: entity.id,
      roomId: 'local',
      kind: 'entities',
      deletedAt: '2026-02-01T00:00:00.000Z',
      deletedBy: 'delete-device',
      clock: { ...baseClock, 'delete-device': 1 },
    })

    const result = mergeIntoYjs([], [])
    const conflict = result.conflicts.find((item) => item.field === '__delete')
    expect(conflict).toBeDefined()
    expect(compareClocks(editClock, getTombstoneMap().get(
      JSON.stringify(['local', 'entities', entity.id]),
    )?.clock as Record<string, number>)).toBeNull()

    expect(applyConflictResolution(new Map(), [conflict!], [], [])).toBe(true)
    expect(getYjsEntities().find((record) => record.id === entity.id)?.name).toBe('Concurrent edit')
  })

  it('keeps same-ID tombstones isolated by record kind', () => {
    addTombstone('shared-id')
    expect(isTombstoned('shared-id')).toBe(true)
    expect(isTombstoned('shared-id', 'claims')).toBe(false)
    addTombstone('shared-id', undefined, 'claims')
    expect(isTombstoned('shared-id', 'claims')).toBe(true)
    expect(isTombstoned('shared-id')).toBe(true)
  })

  it('retains record and tombstone clocks in a reloaded Y.Doc', () => {
    const entity = makeEntity('persisted')
    setYjsEntity(entity)
    addTombstone(entity.id)
    const persistedUpdate = Y.encodeStateAsUpdate(getDoc())
    destroy()
    Y.applyUpdate(getDoc(), persistedUpdate)

    expect(getYjsEntities()).toEqual([])
    expect(getTombstoneMap().get(JSON.stringify(['local', 'entities', entity.id]))).toMatchObject({
      id: entity.id,
      kind: 'entities',
      clock: expect.any(Object),
    })
  })
})
