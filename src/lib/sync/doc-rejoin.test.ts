import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudioStore } from '@/lib/studio/store'
import { addTombstone, clearTombstones, getAllTombstones, getTombstone, getTombstoneMap, isTombstoned } from './tombstones'
import { destroy, getCurrentRoomId, getDoc, getProvider, initPersistence, joinRoom, leaveRoom } from './doc'
import { destroyBridge, getYjsEntities, setYjsEntity, startBidirectionalSync } from './bridge'
import type { Entity } from '@/lib/studio/types'
const mockPersistenceMetadata = vi.hoisted(() => new Map<string, unknown>())
const mockProviders: Array<{ destroy: () => void; awareness: object }> = []

vi.mock('y-webrtc', () => {
  class MockWebrtcProvider {
    awareness = { on: vi.fn(), off: vi.fn() }
    destroy = vi.fn()
    connect = vi.fn()
    disconnect = vi.fn()

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
  it('lists only tombstones whose validated payload belongs to the active room', () => {
    const firstRoom = 'room-a'
    const activeRoom = 'room-b'
    const mismatchedId = 'payload-room-mismatch'

    joinRoom(firstRoom)
    addTombstone('first-room-record')
    joinRoom(activeRoom)
    addTombstone('active-room-record')
    addTombstone(mismatchedId)
    expect(getTombstone(mismatchedId)).not.toBeNull()
    getTombstoneMap().forEach((data, key) => {
      if (data.id === mismatchedId) {
        getTombstoneMap().set(key, { ...data, roomId: firstRoom })
      }
    })

    expect(getAllTombstones().map(({ id, roomId }) => [roomId, id])).toEqual([
      [activeRoom, 'active-room-record'],
    ])
    expect(getTombstone(mismatchedId)).toBeNull()
  })

  it('reads a legacy tombstone from its room-scoped key when its kind is absent', () => {
    const roomId = 'legacy-room'
    const id = 'legacy-key-record'
    joinRoom(roomId)
    getTombstoneMap().set(JSON.stringify([roomId, id]), {
      id,
      roomId,
      deletedAt: '2026-01-01T00:00:00.000Z',
      deletedBy: 'legacy-device',
    })

    expect(getTombstone(id)).toMatchObject({ id, roomId })

    const mismatchedId = 'legacy-payload-room-mismatch'
    getTombstoneMap().set(JSON.stringify([roomId, mismatchedId]), {
      id: mismatchedId,
      roomId: 'other-room',
      deletedAt: '2026-01-01T00:00:00.000Z',
      deletedBy: 'legacy-device',
    })
    const malformedId = 'legacy-malformed-record'
    getTombstoneMap().set(JSON.stringify([roomId, malformedId]), {
      id: malformedId,
      roomId,
      deletedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(getTombstone(mismatchedId)).toBeNull()
    expect(getTombstone(malformedId)).toBeNull()

    const mismatchedPayloadId = 'legacy-payload-id-mismatch'
    getTombstoneMap().set(JSON.stringify([roomId, mismatchedPayloadId]), {
      id: 'different-payload-id',
      roomId,
      deletedAt: '2026-01-01T00:00:00.000Z',
      deletedBy: 'legacy-device',
      kind: 'entities',
    })
    const mismatchedKindId = 'legacy-kind-mismatch'
    getTombstoneMap().set(JSON.stringify([roomId, mismatchedKindId]), {
      id: mismatchedKindId,
      roomId,
      deletedAt: '2026-01-01T00:00:00.000Z',
      deletedBy: 'legacy-device',
      kind: 'claims',
    })
    expect(getTombstone(mismatchedPayloadId)).toBeNull()
    expect(getTombstone(mismatchedKindId)).toBeNull()
  })

  it('ignores malformed tombstones in room-scoped and identity-less lookups', () => {
    const roomId = 'malformed-room'
    const id = 'malformed-record'
    joinRoom(roomId)
    addTombstone(id)
    expect(getTombstone(id)).not.toBeNull()
    getTombstoneMap().forEach((data, key) => {
      if (data.id === id) {
        getTombstoneMap().set(key, {
          id,
          roomId,
          deletedAt: '2026-01-01T00:00:00.000Z',
          kind: 'entities',
        })
      }
    })

    expect(getTombstone(id)).toBeNull()
    expect(getAllTombstones()).toEqual([])

    const persistedDocUpdate = Y.encodeStateAsUpdate(getDoc())
    destroy()
    Y.applyUpdate(getDoc(), persistedDocUpdate)

    expect(getTombstone(id)).toBeNull()
    expect(isTombstoned(id)).toBe(false)
  })

  it('clears tombstones only from the active room', () => {
    joinRoom('room-a')
    addTombstone('room-a-delete')
    leaveRoom()
    joinRoom('room-b')
    addTombstone('room-b-delete')

    clearTombstones()

    expect(getTombstone('room-b-delete')).toBeNull()
    leaveRoom()
    joinRoom('room-a')
    expect(getTombstone('room-a-delete')).not.toBeNull()
  })

  it('checks every room tombstone after the active room identity is lost', () => {
    const id = 'multi-room-tombstone'
    const deviceId = 'clock-device'
    joinRoom('room-a')
    addTombstone(id)
    leaveRoom()
    joinRoom('room-b')
    addTombstone(id)
    getTombstoneMap().forEach((data, key) => {
      if (data.id === id) {
        getTombstoneMap().set(key, {
          ...data,
          clock: { [deviceId]: data.roomId === 'room-a' ? 1 : 3 },
        })
      }
    })

    const persistedDocUpdate = Y.encodeStateAsUpdate(getDoc())
    destroy()
    Y.applyUpdate(getDoc(), persistedDocUpdate)

    expect(isTombstoned(id, 'entities', { [deviceId]: 2 })).toBe(true)
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

  it('makes joinRoom idempotent when called with identical roomId and options', () => {
    const provider1 = joinRoom('room-idempotent', { password: 'pass', signaling: ['wss://sig1'] })
    const provider2 = joinRoom('room-idempotent', { password: 'pass', signaling: ['wss://sig1'] })
    expect(provider1).toBe(provider2)
    expect(mockProviders).toHaveLength(1)

    // Different options should tear down and recreate provider
    const provider3 = joinRoom('room-idempotent', { password: 'pass2', signaling: ['wss://sig1'] })
    expect(provider3).not.toBe(provider1)
    expect(mockProviders).toHaveLength(2)
  })

  it('preserves IndexedDB persistence across leave and rejoin', async () => {
    await initPersistence()
    joinRoom('room-persist')
    leaveRoom()
    expect(getProvider()).toBeNull()

    // Rejoin room
    const rejoinedProvider = joinRoom('room-persist')
    expect(rejoinedProvider).toBeDefined()
    expect(getProvider()).toBe(rejoinedProvider)
    expect(mockPersistenceMetadata.get('lastJoinedRoomId')).toBe('room-persist')
  })

  it('disconnects on browser offline and recreates the provider on online', () => {
    joinRoom('room-connectivity')
    const firstProvider = getProvider() as unknown as {
      destroy: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }

    window.dispatchEvent(new Event('offline'))
    expect(firstProvider.disconnect).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('online'))
    const reconnected = getProvider()
    expect(reconnected).not.toBe(firstProvider)
    expect(firstProvider.destroy).toHaveBeenCalledTimes(1)
    expect(mockProviders).toHaveLength(2)

    leaveRoom()
    if (reconnected) {
      window.dispatchEvent(new Event('offline'))
      expect(firstProvider.disconnect).toHaveBeenCalledTimes(1)
    }
  })
})
