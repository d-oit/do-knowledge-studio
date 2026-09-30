import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PersistedEnvelopeSchema } from './schema'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY, PERSISTED_KEYS } from './hydration'
import { QUARANTINE_KEY, readQuarantine } from './hydration-quarantine'

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

  it('refuses a future-version envelope and quarantines it instead of destroying it', async () => {
    const raw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)

    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()

    // The store must not hydrate a payload written by a newer build.
    expect(useStudioStore.getState().entities.some((e) => e.id === USER_ENTITY.id)).toBe(false)
    // zustand calls setItem() whenever `migrate` returns a value, so the live
    // key is rewritten no matter what we do. The refusal is therefore
    // preserved in quarantine, where the next store write cannot reach it
    // (Plan 158 P0-3). This assertion is what makes the loss non-silent.
    const quarantined = readQuarantine()
    expect(quarantined).not.toBeNull()
    expect(quarantined?.raw).toBe(raw)
    expect(quarantined?.reason).toContain('no safe migration')
  })

  it('keeps quarantined bytes intact after a subsequent store write', async () => {
    // The original bug: the throw skipped only that one setItem, so the very
    // next store write replaced the preserved envelope with seed data.
    writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)
    const { useStudioStore } = await freshStore()
    await useStudioStore.persist.rehydrate()
    const before = readQuarantine()?.raw

    useStudioStore.getState().saveEntity({
      id: 'post-hydration-write',
      name: 'Written after hydration',
      type: 'note',
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    })

    expect(readQuarantine()?.raw).toBe(before)
    expect(readQuarantine()?.raw).not.toBeNull()
  })

  it('leaves the rejected envelope in the live key and blocks further writes', async () => {
    // The user-facing promise: a refused library is never overwritten by seed
    // data, and the app keeps working on a temporary workspace that is
    // visibly marked as not persisted.
    const raw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)

    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    const refusal = getHydrationRefusal()
    expect(refusal).not.toBeNull()
    expect(refusal?.preserved).toBe(true)
    expect(refusal?.raw).toBe(raw)
    // The live key is byte-for-byte the refused envelope: zustand's implicit
    // post-migrate setItem is skipped, not merely outrun.
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
  })

  it('does not let a post-refusal store write touch the refused envelope', async () => {
    const raw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)
    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    // The workspace stays usable…
    useStudioStore.getState().saveEntity({
      id: 'edited-after-refusal',
      name: 'Temporary workspace edit',
      type: 'note',
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    })
    expect(
      useStudioStore.getState().entities.some((e) => e.id === 'edited-after-refusal'),
    ).toBe(true)

    // …but the write is dropped, so the refused bytes survive verbatim in
    // BOTH the live key and quarantine.
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
    expect(readQuarantine()?.raw).toBe(raw)
    expect(getHydrationRefusal()?.preserved).toBe(true)
  })

  it('blocks writes when quarantine itself fails, and says the copy is unsafe', async () => {
    const raw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Quota exhaustion: the rejected bytes cannot be copied aside.
    const real = window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => real.getItem(key),
      removeItem: (key: string) => real.removeItem(key),
      setItem: (key: string, value: string) => {
        if (key === QUARANTINE_KEY) {
          const quota = new Error('quota')
          quota.name = 'QuotaExceededError'
          throw quota
        }
        real.setItem(key, value)
      },
    })

    try {
      const { useStudioStore, getHydrationRefusal } = await freshStore()
      await useStudioStore.persist.rehydrate()

      // No copy exists anywhere, so the app must not silently accept writes:
      // `preserved: false` is what drives the "your edits are not saved" UI.
      expect(getHydrationRefusal()?.preserved).toBe(false)
      expect(readQuarantine()).toBeNull()

      useStudioStore.getState().saveEntity({
        id: 'edit-with-no-safe-copy',
        name: 'Unsaved edit',
        type: 'note',
        description: '',
        content: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [],
      })

      // The original envelope is still intact even though no backup exists.
      expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
      expect(error).toHaveBeenCalled()
    } finally {
      vi.stubGlobal('localStorage', real)
    }
  })

  it('fails closed when the stored envelope cannot be read at all', async () => {
    // Site data blocked / SecurityError: the bytes are there, but every read
    // throws, so zustand's hydrate chain rejects instead of handing `merge` a
    // payload. Seed state must not then be written over an envelope nothing
    // managed to inspect — that is fail-OPEN, the original data-loss bug in a
    // different disguise.
    writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const real = window.localStorage
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem,
      removeItem: () => undefined,
    })

    try {
      const { useStudioStore, getHydrationRefusal } = await freshStore()
      await useStudioStore.persist.rehydrate()

      const refusal = getHydrationRefusal()
      expect(refusal).not.toBeNull()
      // No bytes were readable, so there is no copy to offer and the UI must
      // say this session's edits are not being saved.
      expect(refusal?.preserved).toBe(false)
      expect(refusal?.raw).toBeNull()

      useStudioStore.getState().saveEntity({
        id: 'edit-behind-unreadable-storage',
        name: 'Unsaved edit',
        type: 'note',
        description: '',
        content: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [],
      })

      // The guard drops the write before storage is even touched.
      expect(setItem).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('localStorage', real)
    }
  })

  it('keeps an older distinct quarantined payload and blocks writes', async () => {
    const olderRaw = writeEnvelope(
      validEnvelope({ entities: [{ ...USER_ENTITY, id: 'older-library-entity' }] }),
      CURRENT_SCHEMA_VERSION + 3,
    )
    const olderRecord = JSON.stringify({
      rejectedAt: '2026-01-01T00:00:00.000Z',
      reason: 'older refusal',
      version: CURRENT_SCHEMA_VERSION + 3,
      raw: olderRaw,
    })
    localStorage.setItem(QUARANTINE_KEY, olderRecord)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const currentRaw = writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION + 5)
    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    // Neither record is destroyed: the older preserved copy stays, and the
    // current refused bytes stay in the live key because writes are blocked.
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(olderRecord)
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(currentRaw)
    expect(getHydrationRefusal()?.preserved).toBe(false)

    useStudioStore.getState().saveEntity({
      id: 'edit-behind-older-quarantine',
      name: 'Unsaved edit',
      type: 'note',
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    })

    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(olderRecord)
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(currentRaw)
  })

  it('blocks writes for a same-version malformed envelope, which skips migrate', async () => {
    // Same-version reloads never reach `migrate`, so the `merge` refusal
    // branch is the only gate and must fail closed on its own.
    const raw = writeEnvelope(validEnvelope({ entities: 'not-an-array' }), CURRENT_SCHEMA_VERSION)

    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    expect(getHydrationRefusal()?.preserved).toBe(true)
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
    expect(readQuarantine()?.raw).toBe(raw)

    useStudioStore.getState().saveEntity({
      id: 'edit-after-merge-refusal',
      name: 'Unsaved edit',
      type: 'note',
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    })

    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toBe(raw)
  })

  it('reports no refusal and persists normally after a valid hydrate', async () => {
    writeEnvelope(validEnvelope(), CURRENT_SCHEMA_VERSION)

    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    // The happy path must be untouched: no refusal status and a real write.
    expect(getHydrationRefusal()).toBeNull()
    useStudioStore.getState().saveEntity({
      id: 'normal-write',
      name: 'Normal edit',
      type: 'note',
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    })
    expect(localStorage.getItem(STUDIO_STORAGE_KEY)).toContain('normal-write')
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
