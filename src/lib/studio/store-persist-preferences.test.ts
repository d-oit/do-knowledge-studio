import { describe, it, expect, beforeEach } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY } from './hydration'
import { freshStore, USER_ENTITY, validEnvelope, writeEnvelope } from './store-persist-test-helpers'

describe('persisted UI preferences', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('persists the advanced library filters and layout across a reload', async () => {
    const first = await freshStore()
    await first.useStudioStore.persist.rehydrate()
    first.useStudioStore.getState().setTagQuery('research')
    first.useStudioStore.getState().setHasDescriptionOnly(true)
    first.useStudioStore.getState().setViewMode('list')
    first.useStudioStore.getState().setShowAll(true)

    // The bytes on disk carry them, so the next load reads them back.
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY)
    expect(raw).toContain('"tagQuery":"research"')
    expect(raw).toContain('"hasDescriptionOnly":true')
    expect(raw).toContain('"viewMode":"list"')
    expect(raw).toContain('"showAll":true')

    const second = await freshStore()
    await second.useStudioStore.persist.rehydrate()

    const state = second.useStudioStore.getState()
    expect(state.tagQuery).toBe('research')
    expect(state.hasDescriptionOnly).toBe(true)
    expect(state.viewMode).toBe('list')
    expect(state.showAll).toBe(true)
  })

  it('applies defaults when the stored envelope predates the filter keys', async () => {
    // The shape the previous build wrote: durable preferences, but no
    // advanced-filter/layout keys at all.
    writeEnvelope(
      {
        entities: [USER_ENTITY],
        claims: [],
        chat: [],
        currentView: 'library',
        typeFilter: 'concept',
        sortBy: 'name',
        sortDir: 'asc',
        rightPanelOpen: false,
      },
      CURRENT_SCHEMA_VERSION,
    )

    const { useStudioStore, getHydrationRefusal } = await freshStore()
    await useStudioStore.persist.rehydrate()

    const state = useStudioStore.getState()
    expect(state.entities.some((e) => e.id === USER_ENTITY.id)).toBe(true)
    // Preferences that already existed hydrate untouched…
    expect(state.typeFilter).toBe('concept')
    expect(state.sortBy).toBe('name')
    expect(state.rightPanelOpen).toBe(false)
    // …and the newer keys land on their defaults instead of undefined, which
    // is what kept the filter UI reading as reset after a reload.
    expect(state.tagQuery).toBe('')
    expect(state.hasDescriptionOnly).toBe(false)
    expect(state.viewMode).toBe('grid')
    expect(state.showAll).toBe(false)
    // A pre-existing envelope is a normal load, never a refusal.
    expect(getHydrationRefusal()).toBeNull()
  })

})
