import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudioStore } from '@/lib/studio/store'
import { addTombstone, isTombstoned } from './tombstones'
import { destroy, getCurrentRoomId, getDoc, getProvider, initPersistence, joinRoom, leaveRoom } from './doc'
import { destroyBridge, getYjsEntities, setYjsEntity, startBidirectionalSync } from './bridge'
import type { Entity } from '@/lib/studio/types'
const mockPersistenceMetadata = vi.hoisted(() => new Map<string, unknown>())
const mockProviders: Array<{ destroy: () => void; awareness: object }> = []

vi.mock('y-webrtc', () => {
  class MockWebrtcProvider {
    awareness = { on: vi.fn(), off: vi.fn() }
    destroy = vi.fn()

    constructor(..._args: unknown[]) {
      mockProviders.push(this)
    }
  }

  return { WebrtcProvider: MockWebrtcProvider }
})
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class MockIndexeddbPersistence {
    whenSynced = Promise.resolve()
    destroy = vi.fn()

    constructor(..._args: unknown[]) {}

    get = (key: string): Promise<unknown> => Promise.resolve(mockPersistenceMetadata.get(key))

    set = (key: string, value: unknown): Promise<void> => {
      mockPersistenceMetadata.set(key, value)
      return Promise.resolve()
    }
  },
}))

const makeEntity = (id: string): Entity => ({
  id,
  name: `Entity ${id}`,
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
  mockProviders.length = 0
  mockPersistenceMetadata.clear()
})

afterEach(() => {
  destroyBridge()
  destroy()
  vi.useRealTimers()
})

describe('leaveRoom', () => {
  it('keeps canonical-to-Yjs sync available across room leave and rejoin', () => {
    destroyBridge()
    useStudioStore.setState({ entities: [], claims: [] })
    startBidirectionalSync()
    const doc = getDoc()
    const beforeLeave = makeEntity('before-leave')
    useStudioStore.getState().commitEntity(beforeLeave)

    joinRoom('room-a')
    leaveRoom()

    expect(mockProviders).toHaveLength(1)
    expect(mockProviders[0]?.destroy).toHaveBeenCalledTimes(1)
    expect(getProvider()).toBeNull()
    expect(getDoc()).toBe(doc)
    expect(getYjsEntities()).toEqual([beforeLeave])

    const afterLeave = makeEntity('after-leave')
    useStudioStore.getState().commitEntity(afterLeave)
    expect(getYjsEntities().map((entity) => entity.id)).toContain('after-leave')
  })

  it('keeps tombstones room-scoped across leave, rejoin, and long offline intervals', () => {
    vi.useFakeTimers()
    const deletedAt = new Date('2026-01-01T00:00:00.000Z')
    vi.setSystemTime(deletedAt)
    joinRoom('room-a')
    addTombstone('same-record-id')
    leaveRoom()
    addTombstone('offline-delete')

    joinRoom('room-b')
    expect(isTombstoned('same-record-id')).toBe(false)
    expect(isTombstoned('offline-delete')).toBe(false)
    leaveRoom()

    vi.setSystemTime(new Date('2036-01-01T00:00:00.000Z'))
    joinRoom('room-a')
    expect(isTombstoned('same-record-id')).toBe(true)
    expect(isTombstoned('offline-delete')).toBe(true)
    const persistedDocUpdate = Y.encodeStateAsUpdate(getDoc())
    destroy()
    Y.applyUpdate(getDoc(), persistedDocUpdate)
    joinRoom('room-a')
    expect(isTombstoned('same-record-id')).toBe(true)
    expect(isTombstoned('offline-delete')).toBe(true)
    vi.useRealTimers()
  })

  it('keeps a room deletion hidden while the restored document has no room identity', () => {
    const deletedEntity = makeEntity('persisted-room-delete')
    joinRoom('room-a')
    setYjsEntity(deletedEntity)
    addTombstone(deletedEntity.id)
    const persistedDocUpdate = Y.encodeStateAsUpdate(getDoc())

    destroy()
    Y.applyUpdate(getDoc(), persistedDocUpdate)

    expect(getYjsEntities()).toEqual([])

    joinRoom('room-b')
    expect(getYjsEntities()).toEqual([deletedEntity])
  })

  it('restores the last room from local IndexedDB metadata after document teardown', async () => {
    await initPersistence()
    joinRoom('room-a')
    expect(mockPersistenceMetadata.get('lastJoinedRoomId')).toBe('room-a')

    destroy()
    await initPersistence()

    expect(getCurrentRoomId()).toBe('room-a')
  })
})
