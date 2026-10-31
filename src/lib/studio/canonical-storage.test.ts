import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY } from './hydration'
import {
  CANONICAL_META_KEY,
  CANONICAL_MIGRATION_BACKUP_KEY,
  canonicalStudioStorage,
  getCanonicalRawEnvelope,
  getCanonicalStorageStatus,
  hasCanonicalStoredEnvelope,
  readCanonicalEnvelope,
  resetCanonicalStorageForTests,
} from './canonical-storage'

/** Minimal valid persisted envelope used by the migration tests. */
const envelope = (overrides: Record<string, unknown> = {}) => ({
  state: {
    entities: [
      {
        id: 'canonical-entity',
        name: 'Canonical Entity',
        type: 'note',
        description: '',
        content: 'Stored in IndexedDB',
        tags: ['migrated'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [],
      },
    ],
    claims: [],
    graph: { nodes: [], edges: [] },
    mindMap: { nodes: [], edges: [] },
    links: [],
    tags: [],
    ...overrides,
  },
  version: CURRENT_SCHEMA_VERSION,
})

const rawEnvelope = (overrides: Record<string, unknown> = {}) => JSON.stringify(envelope(overrides))

describe('canonical IndexedDB storage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await resetCanonicalStorageForTests()
  })

  it('migrates a same-version legacy envelope atomically and removes only after verification', async () => {
    const raw = rawEnvelope()
    localStorage.setItem(STUDIO_STORAGE_KEY, raw)

    const loaded = await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)

    expect(loaded).toEqual(envelope())
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()
    expect(await readCanonicalEnvelope()).toEqual(envelope())
    expect(getCanonicalRawEnvelope()).toBe(raw)
    expect(hasCanonicalStoredEnvelope()).toBe(true)
    expect(getCanonicalStorageStatus()).toEqual({ mode: 'indexeddb', reason: null })

    const metadata = JSON.parse(localStorage.getItem(CANONICAL_META_KEY) ?? 'null') as {
      entityCount: number
      claimCount: number
      storage: string
      schemaVersion: number
    } | null
    expect(metadata).toMatchObject({
      entityCount: 1,
      claimCount: 0,
      storage: 'indexeddb',
      schemaVersion: CURRENT_SCHEMA_VERSION,
    })
  })

  it('leaves a future-version envelope in localStorage for the store refusal path', async () => {
    const raw = rawEnvelope()
    const future = JSON.stringify({ ...JSON.parse(raw), version: CURRENT_SCHEMA_VERSION + 5 })
    localStorage.setItem(STUDIO_STORAGE_KEY, future)

    const loaded = await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)

    expect(loaded).toEqual({ ...envelope(), version: CURRENT_SCHEMA_VERSION + 5 })
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(future)
    expect(await readCanonicalEnvelope()).toBeNull()
  })

  it('rejects malformed legacy bytes without deleting them', async () => {
    const raw = '{not-json'
    localStorage.setItem(STUDIO_STORAGE_KEY, raw)

    await expect(canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)).rejects.toThrow()
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
    expect(await readCanonicalEnvelope()).toBeNull()
  })

  it('falls back to legacy when the IndexedDB write fails, keeping the only copy', async () => {
    const raw = rawEnvelope()
    localStorage.setItem(STUDIO_STORAGE_KEY, raw)
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const loaded = await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)

      expect(loaded).toEqual(envelope())
      expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
      expect(localStorage.getItem(CANONICAL_MIGRATION_BACKUP_KEY)).toBe(raw)
      expect(getCanonicalStorageStatus().mode).toBe('legacy-fallback')
      expect(await readCanonicalEnvelope()).toBeNull()
      expect(error).toHaveBeenCalled()
    } finally {
      put.mockRestore()
      error.mockRestore()
    }
  })

  it('keeps the previous canonical record when a later write fails', async () => {
    const first = envelope()
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, first)
    expect(await readCanonicalEnvelope()).toEqual(first)
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()

    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await canonicalStudioStorage.setItem(
        STUDIO_STORAGE_KEY,
        envelope({ entities: [] }),
      )
      expect(getCanonicalStorageStatus().mode).toBe('write-failed')
      expect(await readCanonicalEnvelope()).toEqual(first)
    } finally {
      put.mockRestore()
      error.mockRestore()
    }
  })

  it('leaves an older supported version to zustand migration and moves it on the next write', async () => {
    const raw = JSON.stringify({ state: envelope().state, version: CURRENT_SCHEMA_VERSION - 1 })
    localStorage.setItem(STUDIO_STORAGE_KEY, raw)

    const loaded = await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)
    expect(loaded).toEqual({ state: envelope().state, version: CURRENT_SCHEMA_VERSION - 1 })
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
    expect(await readCanonicalEnvelope()).toBeNull()

    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, envelope())
    expect(await readCanonicalEnvelope()).toEqual(envelope())
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()
  })

  it('lets two tabs read the same legacy envelope without a partial record', async () => {
    const raw = rawEnvelope()
    localStorage.setItem(STUDIO_STORAGE_KEY, raw)

    const [first, second] = await Promise.all([
      canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY),
      canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY),
    ])
    expect(first).toEqual(envelope())
    expect(second).toEqual(envelope())
    expect(await readCanonicalEnvelope()).toEqual(envelope())
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()
  })

  it('round-trips claims, canvas, and tags through a fresh store module', async () => {
    const rich = envelope({
      claims: [
        {
          id: 'claim-1',
          entityId: 'canonical-entity',
          statement: 'A persisted claim',
          confidence: 0.9,
          verification: 'verified',
          version: 1,
          editHistory: [],
        },
      ],
      graph: {
        nodes: [{ id: 'canonical-entity', label: 'Canonical Entity', type: 'note', x: 1, y: 2 }],
        edges: [],
      },
      mindMap: {
        nodes: [{ id: 'canonical-entity', label: 'Canonical Entity', type: 'note' }],
        edges: [],
      },
      links: [
        {
          id: 'link-1',
          sourceId: 'canonical-entity',
          targetId: 'canonical-entity',
          type: 'relates',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tags: [{ id: 'tag-1', name: 'migrated' }],
    })
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, rich)

    vi.resetModules()
    const { useStudioStore } = await import('./store')
    await useStudioStore.persist.rehydrate()

    const state = useStudioStore.getState()
    expect(state.entities[0]?.id).toBe('canonical-entity')
    expect(state.claims[0]?.id).toBe('claim-1')
    expect(state.graph?.nodes[0]?.id).toBe('canonical-entity')
    expect(state.mindMap?.nodes[0]?.id).toBe('canonical-entity')
    expect(state.links?.[0]?.id).toBe('link-1')
    expect(state.tags?.[0]?.id).toBe('tag-1')
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()
  })

  it('removes both canonical and metadata records on reset', async () => {
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, envelope())
    expect(await readCanonicalEnvelope()).not.toBeNull()

    await canonicalStudioStorage.removeItem(STUDIO_STORAGE_KEY)

    expect(await readCanonicalEnvelope()).toBeNull()
    expect(localStorage.getItem(CANONICAL_META_KEY)).toBeNull()
  })
})
