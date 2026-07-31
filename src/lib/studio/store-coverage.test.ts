import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useStudioStore,
  restoreFromRecovery,
  useFilteredEntities,
  useStats,
} from './store'
import type { Entity, Claim } from './types'

const RECOVERY_KEY = 'do-knowledge-studio-recovery'
const STORE_KEY = 'do-knowledge-studio-store'
const originalPersistStorage = useStudioStore.persist.getOptions().storage

function usePersistStorageFailure(failures: number, thrown: unknown): void {
  let calls = 0
  useStudioStore.persist.setOptions({
    storage: {
      getItem: () => null,
      setItem: (name: string) => {
        if (name === STORE_KEY) {
          calls += 1
          if (calls <= failures) throw thrown
        }
      },
      removeItem: () => undefined,
    },
  })
}

function stubLocalStorage(overrides: {
  getItem?: (key: string) => string | null
  setItem?: (key: string, value: string) => void
  removeItem?: (key: string) => void
}): void {
  vi.stubGlobal('localStorage', {
    getItem: overrides.getItem ?? (() => null),
    setItem: overrides.setItem ?? (() => undefined),
    removeItem: overrides.removeItem ?? (() => undefined),
  })
}

function resetStore() {
  useStudioStore.setState({
    entities: [],
    claims: [],
    chat: [],
    selectedEntityId: null,
    editingEntityId: null,
    currentView: 'home',
    searchQuery: '',
    typeFilter: 'all',
    sortBy: 'updated',
    sortDir: 'desc',
    entityHistory: [[]],
    historyIndex: 0,
  })
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `e-${Date.now().toString(36)}`,
    name: 'Test Entity',
    type: 'note',
    description: 'A test entity',
    content: '# Hello',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: `c-${Date.now().toString(36)}`,
    entityId: 'e-1',
    statement: 'Test claim',
    confidence: 0.8,
    verification: 'unverified',
    ...overrides,
  }
}

describe('Studio Store branch coverage', () => {
  beforeEach(() => {
    resetStore()
    localStorage.removeItem(RECOVERY_KEY)
    vi.useFakeTimers()
  })

  afterEach(() => {
    useStudioStore.persist.setOptions({ storage: originalPersistStorage })
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('History (undo/redo)', () => {
    it('trims entityHistory to MAX_HISTORY', () => {
      for (let i = 0; i < 60; i++) {
        useStudioStore.getState().saveEntity(makeEntity({ id: `e-${i}` }))
      }
      const { entityHistory, historyIndex } = useStudioStore.getState()
      expect(entityHistory.length).toBe(50)
      expect(historyIndex).toBe(49)
    })

    it('undo restores snapshots and guards at index 0', () => {
      const e1 = makeEntity({ id: 'e-1', name: 'One' })
      const e2 = makeEntity({ id: 'e-2', name: 'Two' })
      useStudioStore.setState({
        entityHistory: [[], [e1], [e2]],
        historyIndex: 2,
        entities: [e1, e2],
      })
      useStudioStore.getState().undo()
      expect(useStudioStore.getState().entities.map((e) => e.id)).toEqual(['e-1'])
      useStudioStore.getState().undo()
      expect(useStudioStore.getState().entities).toHaveLength(0)
      // Guard: cannot undo below 0
      useStudioStore.getState().undo()
      expect(useStudioStore.getState().historyIndex).toBe(0)
    })

    it('redo restores snapshots and guards at the end', () => {
      const e1 = makeEntity({ id: 'e-1', name: 'One' })
      const e2 = makeEntity({ id: 'e-2', name: 'Two' })
      useStudioStore.setState({
        entityHistory: [[], [e1], [e2]],
        historyIndex: 0,
        entities: [],
      })
      useStudioStore.getState().redo()
      expect(useStudioStore.getState().entities.map((e) => e.id)).toEqual(['e-1'])
      useStudioStore.getState().redo()
      expect(useStudioStore.getState().entities.map((e) => e.id)).toEqual(['e-2'])
      // Guard: cannot redo past the end
      useStudioStore.getState().redo()
      expect(useStudioStore.getState().historyIndex).toBe(2)
    })
  })

  describe('commitEntity', () => {
    it('adds a new entity', () => {
      useStudioStore.getState().commitEntity(makeEntity({ id: 'e-new' }))
      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe('e-new')
    })

    it('replaces an existing entity', () => {
      const entity = makeEntity({ id: 'e-1', name: 'Original' })
      useStudioStore.getState().commitEntity(entity)
      useStudioStore.getState().commitEntity({ ...entity, name: 'Updated' })
      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].name).toBe('Updated')
    })
  })

  describe('updateClaim edit history', () => {
    it('records a history entry when statement changes', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().updateClaim(claimId, { statement: 'Updated' })
      const updated = useStudioStore.getState().claims[0]
      expect(updated.statement).toBe('Updated')
      expect(updated.version).toBe(2)
      expect(updated.editHistory).toHaveLength(1)
      expect(updated.editHistory?.[0]).toMatchObject({ statement: 'Original' })
    })

    it('does not record history when statement is unchanged', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().updateClaim(claimId, { statement: 'Original' })
      expect(useStudioStore.getState().claims[0].editHistory).toHaveLength(0)
    })

    it('does not record history for non-statement updates', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().updateClaim(claimId, { confidence: 0.5 })
      const updated = useStudioStore.getState().claims[0]
      expect(updated.confidence).toBe(0.5)
      expect(updated.editHistory).toHaveLength(0)
    })
  })

  describe('sendMessage reply branches', () => {
    it('produces a no-match reply when search returns nothing', () => {
      useStudioStore.getState().sendMessage('quantum flux')
      expect(useStudioStore.getState().chatLoading).toBe(true)
      vi.advanceTimersByTime(800)
      const { chat, chatLoading } = useStudioStore.getState()
      expect(chatLoading).toBe(false)
      expect(chat).toHaveLength(2)
      expect(chat[1].content).toContain('could not find a direct match')
      expect(chat[1].citations).toHaveLength(0)
    })

    it('uses singular match wording for a single result', () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-solar', name: 'Solar Panel', description: 'solar energy technology' }),
      )
      useStudioStore.getState().sendMessage('solar')
      vi.advanceTimersByTime(800)
      const chat = useStudioStore.getState().chat
      expect(chat[1].content).toContain('Based on 1 match')
    })

    it('uses plural match wording for multiple results', () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-a', name: 'Reactor A', description: 'reactor design' }),
      )
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-b', name: 'Reactor B', description: 'reactor coolant' }),
      )
      useStudioStore.getState().sendMessage('reactor')
      vi.advanceTimersByTime(800)
      expect(useStudioStore.getState().chat[1].content).toContain('Based on 2 matches')
    })

    it('maps entity results to citations via id/name fallbacks', () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-solar', name: 'Solar Panel', description: 'solar energy technology' }),
      )
      useStudioStore.getState().sendMessage('solar')
      vi.advanceTimersByTime(800)
      const citations = useStudioStore.getState().chat[1].citations ?? []
      expect(citations).toHaveLength(1)
      expect(citations[0].entityId).toBe('e-solar')
      expect(citations[0].entityName).toBe('Solar Panel')
    })

    it('maps claim results to citations via entityId/entityName', () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-reactor', name: 'Reactor', description: 'core reactor' }),
      )
      useStudioStore.getState().addClaim(
        makeClaim({
          id: 'c-1',
          entityId: 'e-reactor',
          statement: 'neutron absorption drives fission',
        }),
      )
      useStudioStore.getState().sendMessage('neutron')
      vi.advanceTimersByTime(800)
      const citations = useStudioStore.getState().chat[1].citations ?? []
      expect(citations).toHaveLength(1)
      expect(citations[0].entityId).toBe('e-reactor')
      expect(citations[0].entityName).toBe('Reactor')
    })
  })

  describe('importWithRollback', () => {
    it('succeeds and persists a recovery snapshot', () => {
      const entities = [makeEntity({ id: 'imp-1' })]
      const result = useStudioStore.getState().importWithRollback(entities, [])
      expect(result.success).toBe(true)
      const state = useStudioStore.getState()
      expect(state.entities).toHaveLength(1)
      expect(state.currentView).toBe('library')
      expect(state.entityHistory).toEqual([entities])
      expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
    })

    it('warns and skips persistence when snapshot exceeds size limit', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const big = makeEntity({ id: 'big', content: 'a'.repeat(5 * 1024 * 1024) })
      // The recovery snapshot is taken from the CURRENT state — seed the store
      // with the oversized entity so the serialized blob exceeds the size limit.
      useStudioStore.getState().saveEntity(big)
      const result = useStudioStore.getState().importWithRollback([big], [])
      expect(result.success).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds size limit'))
    })

    it('warns and continues when recovery persistence fails', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      stubLocalStorage({
        setItem: (key: string) => {
          if (key === RECOVERY_KEY) throw new Error('quota exceeded')
        },
      })
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'x' })], [])
      expect(result.success).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith('Failed to persist recovery snapshot')
    })

    it('rolls back state when the primary set fails with an Error', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'keep' }))
      usePersistStorageFailure(1, new Error('boom'))
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'imp' })], [])
      expect(result.success).toBe(false)
      expect(result.error).toBe('boom')
      expect(useStudioStore.getState().entities.map((e) => e.id)).toEqual(['keep'])
    })

    it('falls back to seed state when rollback also fails', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'keep' }))
      usePersistStorageFailure(2, new Error('boom'))
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'imp' })], [])
      expect(result.success).toBe(false)
      expect(useStudioStore.getState().entities.length).toBeGreaterThan(0)
    })

    it('uses generic error message when the thrown value is not an Error', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'keep' }))
      const boom: unknown = { message: 'boom' }
      usePersistStorageFailure(1, boom)
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'imp' })], [])
      expect(result.success).toBe(false)
      expect(result.error).toBe('Import failed, state restored.')
    })
  })

  describe('restoreFromRecovery', () => {
    const validPayload = () => ({
      snapshot: {
        entities: [
          makeEntity({
            id: 'rec-1',
            name: 'Recovered',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
        claims: [],
        entityHistory: [[{ id: 'rec-1' }]],
        historyIndex: 0,
      },
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000,
    })

    it('returns no-snapshot error when key is absent', () => {
      const result = restoreFromRecovery()
      expect(result).toEqual({ success: false, error: 'No recovery snapshot found.' })
    })

    it('returns corrupted error and clears key when JSON is invalid', () => {
      localStorage.setItem(RECOVERY_KEY, 'not json')
      const result = restoreFromRecovery()
      expect(result.success).toBe(false)
      expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
    })

    it('returns corrupted error when schema validation fails', () => {
      localStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ snapshot: { entities: 'wrong' }, timestamp: 123 }),
      )
      const result = restoreFromRecovery()
      expect(result).toEqual({ success: false, error: 'Recovery snapshot is corrupted.' })
      expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
    })

    it('returns expired error when snapshot is older than ttl', () => {
      localStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ ...validPayload(), timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 }),
      )
      const result = restoreFromRecovery()
      expect(result).toEqual({ success: false, error: 'Recovery snapshot has expired.' })
      expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
    })

    it('restores state and clears the key on success', () => {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(validPayload()))
      const result = restoreFromRecovery()
      expect(result).toEqual({ success: true })
      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe('rec-1')
      expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
    })

    it('returns the thrown message when storage access fails', () => {
      stubLocalStorage({
        getItem: () => {
          throw new Error('storage error')
        },
      })
      const result = restoreFromRecovery()
      expect(result).toEqual({ success: false, error: 'storage error' })
    })
  })

  describe('useFilteredEntities', () => {
    const e1 = makeEntity({
      id: 'e-1',
      name: 'Solar Panel',
      type: 'concept',
      description: 'energy technology',
      tags: ['green'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const e2 = makeEntity({
      id: 'e-2',
      name: 'Nuclear Reactor',
      type: 'reference',
      description: 'fission power',
      tags: ['power'],
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })

    it('filters by type', () => {
      useStudioStore.setState({ entities: [e1, e2], typeFilter: 'all' })
      const { result } = renderHook(() => useFilteredEntities())
      expect(result.current).toHaveLength(2)
      act(() => {
        useStudioStore.getState().setTypeFilter('concept')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
    })

    it('filters by search query across name, description, and tags', () => {
      useStudioStore.setState({ entities: [e1, e2], typeFilter: 'all', searchQuery: '' })
      const { result } = renderHook(() => useFilteredEntities())
      act(() => {
        useStudioStore.getState().setSearchQuery('solar')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
      act(() => {
        useStudioStore.getState().setSearchQuery('power')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-2'])
      act(() => {
        useStudioStore.getState().setSearchQuery('   energy   ')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
      act(() => {
        useStudioStore.getState().setSearchQuery('zzz')
      })
      expect(result.current).toHaveLength(0)
    })

    it('sorts by name, created, and updated in both directions', () => {
      useStudioStore.setState({
        entities: [e1, e2],
        typeFilter: 'all',
        searchQuery: '',
        sortBy: 'updated',
        sortDir: 'desc',
      })
      const { result } = renderHook(() => useFilteredEntities())
      expect(result.current.map((e) => e.id)).toEqual(['e-2', 'e-1'])
      act(() => {
        useStudioStore.getState().setSortDir('asc')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1', 'e-2'])
      act(() => {
        useStudioStore.getState().setSortBy('name')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-2', 'e-1'])
      act(() => {
        useStudioStore.getState().setSortBy('created')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1', 'e-2'])
    })
  })

  describe('useStats', () => {
    it('computes totals, verified count, type breakdown, and recent entities', () => {
      const e1 = makeEntity({
        id: 'e-1',
        type: 'concept',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      const e2 = makeEntity({
        id: 'e-2',
        type: 'concept',
        updatedAt: '2026-01-02T00:00:00.000Z',
      })
      const e3 = makeEntity({
        id: 'e-3',
        type: 'reference',
        updatedAt: '2026-01-03T00:00:00.000Z',
      })
      useStudioStore.setState({
        entities: [e1, e2, e3],
        claims: [
          makeClaim({ id: 'c-1', verification: 'verified' }),
          makeClaim({ id: 'c-2', verification: 'unverified' }),
          makeClaim({ id: 'c-3', verification: 'verified' }),
        ],
      })
      const { result } = renderHook(() => useStats())
      expect(result.current.total).toBe(3)
      expect(result.current.claims).toBe(3)
      expect(result.current.verified).toBe(2)
      expect(result.current.byType).toEqual({ concept: 2, reference: 1 })
      expect(result.current.recent.map((e) => e.id)).toEqual(['e-3', 'e-2', 'e-1'])
    })
  })
})
