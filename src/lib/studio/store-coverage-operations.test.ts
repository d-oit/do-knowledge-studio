import { describe, it, expect } from 'vitest'
import { useStudioStore } from './store'
import { makeClaim, makeEntity } from './test-helpers'
import { installStoreCoverageHooks } from './store-coverage-support'

installStoreCoverageHooks()

describe('Studio Store branch coverage', () => {
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

  describe('commitEntities idempotence', () => {
    it('does not insert the same new id twice in one batch', () => {
      useStudioStore.setState({ entities: [], claims: [] })
      const dup = makeEntity({ id: 'dup', name: 'Dup' })

      useStudioStore.getState().commitEntities([dup, { ...dup }])

      // A repeated new id used to yield [dup, dup] — a duplicate library
      // entry and an ambiguous deleteEntity target.
      const ids = useStudioStore.getState().entities.map((e) => e.id)
      expect(ids).toEqual(['dup'])
    })

    it('still merges an existing id rather than duplicating it', () => {
      const existing = makeEntity({ id: 'e-keep', name: 'Before' })
      useStudioStore.setState({ entities: [existing], claims: [] })

      useStudioStore.getState().commitEntities([makeEntity({ id: 'e-keep', name: 'After' })])

      const entities = useStudioStore.getState().entities
      expect(entities).toHaveLength(1)
      expect(entities[0].name).toBe('After')
    })
  })

  describe('commitEntities', () => {
    it('commits a batch under one history snapshot so a single undo restores all writes', () => {
      const source = makeEntity({ id: 'e-src', name: 'Source' })
      const target = makeEntity({ id: 'e-tgt', name: 'Target' })
      useStudioStore.setState({ entities: [source, target] })

      useStudioStore.getState().commitEntities([
        { ...source, links: [{ targetId: 'e-tgt', relation: 'mentions' }] },
        { ...target, links: [{ targetId: 'e-src', relation: 'mentioned-in' }] },
      ])
      expect(useStudioStore.getState().entities.find((e) => e.id === 'e-src')?.links).toHaveLength(1)
      expect(useStudioStore.getState().entities.find((e) => e.id === 'e-tgt')?.links).toHaveLength(1)
      // The batch is one history step (pre-change snapshot appended once).
      expect(useStudioStore.getState().historyIndex).toBe(1)

      useStudioStore.getState().undo()
      // One undo restores the pre-batch snapshot: both entities keep their
      // ids but the reciprocal links are gone together.
      const { entities } = useStudioStore.getState()
      expect(entities.find((e) => e.id === 'e-src')?.links ?? []).toHaveLength(0)
      expect(entities.find((e) => e.id === 'e-tgt')?.links ?? []).toHaveLength(0)
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
})
