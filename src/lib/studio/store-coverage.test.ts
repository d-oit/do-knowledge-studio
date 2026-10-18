import { describe, it, expect, vi } from 'vitest'
import { useStudioStore } from './store'
import type { Entity, Claim } from './types'
import { makeClaim, makeEntity } from './test-helpers'
import { installStoreCoverageHooks } from './store-coverage-support'

/**
 * Pristine store state from a FRESH module instance. Capturing at import time
 * is not enough: this file's helpers mutate the shared store, and a capture
 * taken before them can still observe a wiped corpus.
 */
const loadPristineState = async () => {
  // A fresh module re-reads localStorage, so the key must be empty or the
  // previous tests' wiped state is what comes back.
  localStorage.clear()
  vi.resetModules()
  const fresh = await import('./store')
  return fresh.useStudioStore.getState()
}



/** Builds one history snapshot for the tests, mirroring the store's shape. */
const step = (...entities: Entity[]) => ({ entities, claims: [] as Claim[] })


installStoreCoverageHooks()

describe('Studio Store branch coverage', () => {
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
        entityHistory: [step(), step(e1), step(e2)],
        historyIndex: 2,
        entities: [e1, e2],
        claims: [],
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
        entityHistory: [step(), step(e1), step(e2)],
        historyIndex: 0,
        entities: [],
        claims: [],
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

  describe('Seed integrity (slice composition order)', () => {
    /**
     * The suite's beforeEach wipes the store, so the seed is re-asserted
     * against the pristine initial state captured at module load.
     */
    it('keeps the seeded chat so the transcript is not empty on first load', async () => {
      const pristine = await loadPristineState()
      // Regression: the chat slice declared `chat: []` and the store spread
      // slices AFTER the seed, so the seeded welcome message was overwritten.
      // Symptoms were an empty transcript and a permanently disabled
      // "Clear chat history" control, failing e2e/chat-a11y.spec.ts. The
      // store now spreads slices first and seed last.
      expect(pristine.chat.length).toBeGreaterThan(0)
      expect(pristine.chat[0]?.role).toBe('assistant')
    })

    it('keeps the seeded corpus and an undo baseline that mirrors it', async () => {
      const pristine = await loadPristineState()
      expect(pristine.entities.length).toBeGreaterThan(0)
      expect(pristine.claims.length).toBeGreaterThan(0)
      expect(pristine.entityHistory).toHaveLength(1)
      expect(pristine.entityHistory[0].entities).toHaveLength(pristine.entities.length)
      expect(pristine.entityHistory[0].claims).toHaveLength(pristine.claims.length)
      expect(pristine.historyIndex).toBe(0)
    })

    it('does not let a slice default shadow a seeded field', async () => {
      const pristine = await loadPristineState()
      // The composition order is the actual contract: any slice that declares
      // a seed-owned key would silently win if seed were spread first.
      expect(pristine.chat).not.toEqual([])
    })
  })

  describe('History integrity: claims and links (D1.6/D1.22)', () => {
    it('undoing a deleteEntity restores the entity together with its claims', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-keep' }))
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-keep', statement: 'keep me' }))
      useStudioStore.getState().deleteEntity('e-keep')
      expect(useStudioStore.getState().claims).toHaveLength(0)

      useStudioStore.getState().undo()

      // The entity edit is only half the transaction: the claims it owned
      // must come back with it, or undo silently loses user data.
      expect(useStudioStore.getState().entities.map((e) => e.id)).toEqual(['e-keep'])
      expect(useStudioStore.getState().claims).toHaveLength(1)
      expect(useStudioStore.getState().claims[0].statement).toBe('keep me')
    })

    it('undoes a standalone claim edit without touching entities', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-claim' }))
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-claim', statement: 'original' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().updateClaim(claimId, { statement: 'rewritten' })
      expect(useStudioStore.getState().claims[0].statement).toBe('rewritten')

      useStudioStore.getState().undo()

      expect(useStudioStore.getState().claims[0].statement).toBe('original')
    })

    it('undoes a claim deletion', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-del' }))
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-del', statement: 'doomed' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().deleteClaim(claimId)
      expect(useStudioStore.getState().claims).toHaveLength(0)

      useStudioStore.getState().undo()

      expect(useStudioStore.getState().claims).toHaveLength(1)
      expect(useStudioStore.getState().claims[0].statement).toBe('doomed')
    })

    it('preserves claims written after an entity edit when that edit is undone', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-mix', name: 'Before' }))
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-mix', statement: 'claim one' }))
      useStudioStore.getState().commitEntity(makeEntity({ id: 'e-mix', name: 'After' }))

      useStudioStore.getState().undo()

      // Only the entity edit reverts; the claim added before it survives.
      expect(useStudioStore.getState().entities[0].name).toBe('Before')
      expect(useStudioStore.getState().claims.map((c) => c.statement)).toEqual(['claim one'])
    })

    it('redo replays the claim side of an undone transaction', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-redo' }))
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-redo', statement: 'redo me' }))

      useStudioStore.getState().undo()
      expect(useStudioStore.getState().claims).toHaveLength(0)

      useStudioStore.getState().redo()
      expect(useStudioStore.getState().claims.map((c) => c.statement)).toEqual(['redo me'])
    })

    it('undo drops a selectedEntityId that the restored state no longer contains', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-selected' }))
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-other' }))
      useStudioStore.getState().selectEntity('e-other')

      useStudioStore.getState().undo()

      // 'e-other' did not exist one step back — a dangling id would render
      // the editor and right panel for a missing entity.
      expect(useStudioStore.getState().selectedEntityId).toBeNull()
    })

    it('undo drops an editingEntityId that the restored state no longer contains', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-editing' }))
      useStudioStore.getState().startEdit('e-editing')
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-second' }))
      useStudioStore.getState().startEdit('e-second')
      expect(useStudioStore.getState().editingEntityId).toBe('e-second')

      useStudioStore.getState().undo()

      expect(useStudioStore.getState().editingEntityId).toBeNull()
    })

    it('keeps a selection that survives the undo', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-survivor' }))
      useStudioStore.getState().selectEntity('e-survivor')
      useStudioStore.getState().commitEntity(makeEntity({ id: 'e-survivor', name: 'Edited' }))

      useStudioStore.getState().undo()

      expect(useStudioStore.getState().selectedEntityId).toBe('e-survivor')
    })

    it('undo never restores a link to an entity missing from the snapshot', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-link-src', links: [{ targetId: 'e-gone', relation: 'mentions' }] }))
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-gone' }))
      // Drop the target from the live corpus, leaving a dangling link.
      useStudioStore.setState((state) => ({ entities: state.entities.filter((e) => e.id !== 'e-gone') }))

      useStudioStore.getState().undo()

      // The step being undone predates 'e-gone', so restoring it must not
      // resurrect a link that points at nothing.
      const restored = useStudioStore.getState().entities.find((e) => e.id === 'e-link-src')
      expect(restored?.links).toHaveLength(0)
    })

    it('addClaims records a bulk extract as a single undo step', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-bulk' }))
      useStudioStore.getState().addClaims([
        { entityId: 'e-bulk', statement: 'first', confidence: 0.5, verification: 'unverified' },
        { entityId: 'e-bulk', statement: 'second', confidence: 0.5, verification: 'unverified' },
      ])
      expect(useStudioStore.getState().claims).toHaveLength(2)

      useStudioStore.getState().undo()

      // One undo reverses the whole extraction, not one claim at a time.
      expect(useStudioStore.getState().claims).toHaveLength(0)
    })

    it('addClaims with no drafts pushes no history step', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-noop' }))
      const before = useStudioStore.getState().historyIndex
      useStudioStore.getState().addClaims([])
      expect(useStudioStore.getState().historyIndex).toBe(before)
    })

    it('trims the widened history stack to MAX_HISTORY', () => {
      for (let i = 0; i < 60; i++) {
        useStudioStore.getState().addClaim(
          makeClaim({ entityId: 'e-trim', statement: `claim ${i}` }),
        )
      }
      const { entityHistory, historyIndex } = useStudioStore.getState()
      expect(entityHistory.length).toBe(50)
      expect(historyIndex).toBe(49)
      // Every retained step must carry claims, not just entities.
      expect(entityHistory.at(-1)?.claims).toHaveLength(60)
    })
  })




})
