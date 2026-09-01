import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  saveIndexedDBSnapshot,
  loadIndexedDBSnapshot,
  clearIndexedDBSnapshots,
} from './indexeddb-backup'
import type { RecoverySnapshot } from './recovery-helpers'

const dummySnapshot: RecoverySnapshot = {
  entities: [
    {
      id: 'e-1',
      name: 'Test Node',
      type: 'note',
      description: 'Desc',
      content: 'Content',
      tags: [],
      created: '2026-09-01T00:00:00.000Z',
      updated: '2026-09-01T00:00:00.000Z',
      links: [],
    },
  ],
  claims: [],
  entityHistory: [],
  historyIndex: 0,
}

describe('IndexedDB Tiered Backup Module', () => {
  const originalIndexedDB = globalThis.indexedDB

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB
  })

  it('returns false/null when indexedDB is not available', async () => {
    // @ts-expect-error simulating missing indexedDB
    delete globalThis.indexedDB
    const saved = await saveIndexedDBSnapshot(dummySnapshot)
    expect(saved).toBe(false)

    const loaded = await loadIndexedDBSnapshot()
    expect(loaded).toBeNull()

    const cleared = await clearIndexedDBSnapshots()
    expect(cleared).toBe(false)
  })

  it('stores, retrieves, and clears snapshots when indexedDB is mocked', async () => {
    const storage = new Map<string, unknown>()
    const mockStore = {
      put: vi.fn((val: unknown, key: string) => {
        storage.set(key, val)
        const req = { onsuccess: null as (() => void) | null, onerror: null }
        setTimeout(() => { req.onsuccess?.() }, 0)
        return req
      }),
      get: vi.fn((key: string) => {
        const val = storage.get(key)
        const req = { result: val, onsuccess: null as (() => void) | null, onerror: null }
        setTimeout(() => { req.onsuccess?.() }, 0)
        return req
      }),
      clear: vi.fn(() => {
        storage.clear()
        const req = { onsuccess: null as (() => void) | null, onerror: null }
        setTimeout(() => { req.onsuccess?.() }, 0)
        return req
      }),
    }

    const mockDb = {
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => mockStore),
        oncomplete: null as (() => void) | null,
      })),
      close: vi.fn(),
    }

    const mockOpenReq = {
      result: mockDb,
      onsuccess: null as (() => void) | null,
      onerror: null,
      onupgradeneeded: null,
    }

    globalThis.indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => { mockOpenReq.onsuccess?.() }, 0)
        return mockOpenReq as unknown as IDBOpenDBRequest
      }),
    } as unknown as IDBFactory

    const saveResult = await saveIndexedDBSnapshot(dummySnapshot)
    expect(saveResult).toBe(true)

    const loadResult = await loadIndexedDBSnapshot()
    expect(loadResult).toEqual(dummySnapshot)

    const clearResult = await clearIndexedDBSnapshots()
    expect(clearResult).toBe(true)

    const loadAfterClear = await loadIndexedDBSnapshot()
    expect(loadAfterClear).toBeNull()
  })
})
