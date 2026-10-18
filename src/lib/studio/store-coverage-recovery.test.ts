import { describe, it, expect, vi } from 'vitest'
import { useStudioStore, restoreFromRecovery } from './store'
import { makeEntity } from './test-helpers'
import {
  installStoreCoverageHooks,
  RECOVERY_KEY,
  stubLocalStorage,
  usePersistStorageFailure,
} from './store-coverage-support'

installStoreCoverageHooks()

describe('Studio Store branch coverage', () => {
  describe('importWithRollback', () => {
    it('succeeds and persists a recovery snapshot', () => {
      const entities = [makeEntity({ id: 'imp-1' })]
      const result = useStudioStore.getState().importWithRollback(entities, [])
      expect(result.success).toBe(true)
      const state = useStudioStore.getState()
      expect(state.entities).toHaveLength(1)
      expect(state.entityHistory).toHaveLength(1)
      expect(state.currentView).toBe('library')
      expect(state.entityHistory[0]?.entities).toEqual(entities)
      expect(state.entityHistory[0]?.claims).toEqual([])
      expect(state.entityHistory[0]?.canvas).toEqual({ graph: undefined, mindMap: undefined, links: undefined })
      expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
    })

    it('warns and skips persistence when snapshot exceeds size limit', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const big = makeEntity({ id: 'big', content: 'a'.repeat(5 * 1024 * 1024) })
      // The recovery snapshot is taken from the CURRENT state — seed the store
      // with the oversized entity so the serialized blob exceeds the size limit.
      useStudioStore.getState().saveEntity(big)
      const result = useStudioStore.getState().importWithRollback([big], [])
      expect(result.success).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds size limit'))
    })

    it('warns and continues when recovery persistence fails', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      stubLocalStorage({
        setItem: (key: string) => {
          if (key === RECOVERY_KEY) throw new Error('quota exceeded')
        },
      })
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'x' })], [])
      expect(result.success).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist recovery snapshot'))
    })

    it('rolls back state when the primary set fails with an Error', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'keep' }))
      usePersistStorageFailure(1, new Error('boom'))
      const result = useStudioStore.getState().importWithRollback([makeEntity({ id: 'imp' })], [])
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected the import to fail')
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
      if (result.success) throw new Error('expected the import to fail')
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
        entityHistory: [
          {
            entities: [
              makeEntity({
                id: 'rec-1',
                name: 'Recovered',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              }),
            ],
            claims: [],
          },
        ],
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
      expect(result).toEqual({ success: true, snapshotCleared: true })
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
})
