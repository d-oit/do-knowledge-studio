import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PersistedEnvelopeSchema } from './schema'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY, PERSISTED_KEYS } from './hydration'

/**
 * Composed persistence round-trip tests (Plan 131 G1).
 *
 * Each test rebuilds the store module against the shared localStorage mock
 * so the full pipeline — partialize → serialize → read → migrate → Zod
 * validate → merge — executes exactly as it does on a page reload. Values
 * are stored in the middleware's real envelope format ({ state, version }).
 */

const freshStore = async () => {
  vi.resetModules()
  return import('./store')
}

const writeEnvelope = (state: Record<string, unknown>, version: number): string => {
  const raw = JSON.stringify({ state, version })
  localStorage.setItem(STUDIO_STORAGE_KEY, raw)
  return raw
}

const USER_ENTITY = {
  id: 'persist-test-user-entity',
  name: 'User Corpus Marker',
  type: 'note' as const,
  description: 'Created by the user before reload.',
  content: 'User content',
  tags: ['important'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

const validEnvelope = (overrides: Record<string, unknown> = {}) => ({
  entities: [USER_ENTITY],
  claims: [],
  chat: [],
  currentView: 'library',
  typeFilter: 'all',
  sortBy: 'updated',
  sortDir: 'desc',
  rightPanelOpen: true,
  ...overrides,
})

describe('persistence round-trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('undo after reload never reverts the corpus to seed data', async () => {
    // Session 1: user creates an entity.
    const first = await freshStore()
    await first.useStudioStore.persist.rehydrate()
    first.useStudioStore.getState().commitEntity({ ...USER_ENTITY })
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).not.toBeNull()

    // Session 2: reload, then edit and immediately undo.
    const second = await freshStore()
    await second.useStudioStore.persist.rehydrate()
    const hydrated = second.useStudioStore.getState().entities
    expect(hydrated.some((e) => e.id === USER_ENTITY.id)).toBe(true)

    second.useStudioStore.getState().commitEntity({
      ...USER_ENTITY,
      name: 'Renamed by user',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    second.useStudioStore.getState().undo()

    const afterUndo = second.useStudioStore.getState().entities
    expect(afterUndo.some((e) => e.id === USER_ENTITY.id && e.name === USER_ENTITY.name)).toBe(
      true,
    )
    // The full hydrated corpus survives undo — the pre-fix bug collapsed it
    // to the 8-item demo seed set with the user entity gone.
    expect(afterUndo).toHaveLength(hydrated.length)
  })

  it('discards corrupt payloads and preserves them for recovery', async () => {
    // One record missing its tags array would previously crash rendering.
    const raw = writeEnvelope(validEnvelope({ entities: [{ ...USER_ENTITY, tags: undefined }] }), CURRENT_SCHEMA_VERSION)

    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()

    const state = useStudioStore.getState()
    expect(state.entities.some((e) => e.id === USER_ENTITY.id)).toBe(false)
    // Store remains usable with the seed workspace intact…
    expect(Array.isArray(state.entities)).toBe(true)
    expect(state.entities.length).toBeGreaterThan(0)
    // …and the rejected payload stays on disk untouched for recovery.
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
  })

  it('rejects future-version envelopes without rewriting them', async () => {
    const raw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)

    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()

    expect(useStudioStore.getState().entities.some((e) => e.id === USER_ENTITY.id)).toBe(false)
    // The untouched envelope stays available for a newer build / recovery.
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
  })

  it('migrates legacy v1 envelopes lacking preference keys', async () => {
    writeEnvelope(
      {
        entities: [
          {
            id: 'e1',
            name: 'Legacy Note',
            type: 'note',
            description: '',
            content: '',
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ],
        claims: [],
        version: 1,
      },
      1,
    )

    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()

    const state = useStudioStore.getState()
    expect(state.entities[0]?.id).toBe('e1')
    // Backfilled by the migration chain.
    expect(state.entities[0]?.tags).toEqual([])
    // Absent preferences fall back to defaults instead of rejecting.
    expect(state.currentView).toBe('home')
    expect(state.rightPanelOpen).toBe(true)
  })

  it('preserves durable UI preferences through a version-migration reload', async () => {
    // Claims predate the v1→v2 timestamp backfill, forcing the chain to run;
    // preferences written alongside must survive it (Plan 131 D1.4).
    writeEnvelope(
      validEnvelope({
        claims: [
          { id: 'c1', entityId: USER_ENTITY.id, statement: 'S', confidence: 0.5, verification: 'unverified' },
        ],
        version: 1,
        typeFilter: 'person',
        sortBy: 'name',
        sortDir: 'asc',
        rightPanelOpen: false,
      }),
      1,
    )

    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()

    const state = useStudioStore.getState()
    expect(state.entities.some((e) => e.id === USER_ENTITY.id)).toBe(true)
    expect(state.typeFilter).toBe('person')
    expect(state.sortBy).toBe('name')
    expect(state.sortDir).toBe('asc')
    expect(state.rightPanelOpen).toBe(false)
    // Migration backfilled claim timestamps.
    expect(useStudioStore.getState().claims[0]?.createdAt).toBeDefined()
  })

  it('never persists the search query', async () => {
    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()
    useStudioStore.getState().setSearchQuery('keystroke storm')

    const raw = localStorage.getItem(STUDIO_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw).not.toContain('"searchQuery"')
  })

  it('keeps partialize keys and the envelope schema in lockstep', () => {
    const schemaKeys = Object.keys(PersistedEnvelopeSchema.shape)
      .filter((key) => key !== 'version')
      .sort()
    expect(schemaKeys).toEqual([...PERSISTED_KEYS].sort())
  })
})
