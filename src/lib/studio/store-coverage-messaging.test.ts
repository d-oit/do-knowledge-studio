import { describe, it, expect } from 'vitest'
import { useStudioStore } from './store'
import { makeClaim, makeEntity } from './test-helpers'
import { search } from '@/lib/search/retrieval'
import { installStoreCoverageHooks } from './store-coverage-support'

installStoreCoverageHooks()

describe('Studio Store branch coverage', () => {
  describe('sendMessage reply branches', () => {
    it('produces a no-match reply when search returns nothing', async () => {
      await useStudioStore.getState().sendMessage('quantum flux')
      const { chat, chatLoading } = useStudioStore.getState()
      expect(chatLoading).toBe(false)
      expect(chat).toHaveLength(2)
      expect(chat[1].content).toContain('could not find a direct match')
      expect(chat[1].citations).toHaveLength(0)
    })

    it('uses singular match wording for a single result', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-solar', name: 'Solar Panel', description: 'solar energy technology' }),
      )
      await useStudioStore.getState().sendMessage('solar')
      const chat = useStudioStore.getState().chat
      expect(chat[1].content).toContain('Based on 1 match')
    })

    it('uses plural match wording for multiple results', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-a', name: 'Reactor A', description: 'reactor design' }),
      )
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-b', name: 'Reactor B', description: 'reactor coolant' }),
      )
      await useStudioStore.getState().sendMessage('reactor')
      expect(useStudioStore.getState().chat[1].content).toContain('Based on 2 matches')
    })

    it('maps entity results to citations via id/name fallbacks', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-solar', name: 'Solar Panel', description: 'solar energy technology' }),
      )
      await useStudioStore.getState().sendMessage('solar')
      const citations = useStudioStore.getState().chat[1].citations ?? []
      expect(citations).toHaveLength(1)
      expect(citations[0].entityId).toBe('e-solar')
      expect(citations[0].entityName).toBe('Solar Panel')
    })

    it('maps claim results to citations via entityId/entityName', async () => {
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
      await useStudioStore.getState().sendMessage('neutron')
      const citations = useStudioStore.getState().chat[1].citations ?? []
      expect(citations).toHaveLength(1)
      expect(citations[0].entityId).toBe('e-reactor')
      expect(citations[0].entityName).toBe('Reactor')
    })
  })

  describe('sendMessage with BM25 reference cache (PR #647)', () => {
    it('returns consistent citations on repeated messages with unchanged state', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-cache', name: 'Cache Probe', description: 'reference caching works' }),
      )
      await useStudioStore.getState().sendMessage('reference caching')
      const first = useStudioStore.getState().chat[1]
      // No store mutations between calls — search must hit the cached index.
      await useStudioStore.getState().sendMessage('reference caching')
      const second = useStudioStore.getState().chat[3]
      expect(second.citations).toEqual(first.citations)
      expect(second.content).toBe(first.content)
      expect(first.citations?.[0].entityId).toBe('e-cache')
    })

    it('invalidates the cached index when entities change via saveEntity', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-before', name: 'Old Topic', description: 'outdated search text' }),
      )
      await useStudioStore.getState().sendMessage('outdated search')
      expect(useStudioStore.getState().chat[1].citations?.[0].entityId).toBe('e-before')

      // saveEntity replaces the entities array — next search must rebuild the index.
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-after', name: 'New Topic', description: 'fresh search text' }),
      )
      await useStudioStore.getState().sendMessage('fresh search')
      const citations = useStudioStore.getState().chat[3].citations ?? []
      expect(citations.some((c) => c.entityId === 'e-after')).toBe(true)
    })

    it('invalidates the cached index when claims change via addClaim', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-claims', name: 'Claims Cache', description: 'claims invalidation' }),
      )
      useStudioStore.getState().addClaim(
        makeClaim({ id: 'c-cache-1', entityId: 'e-claims', statement: 'first claim about claims' }),
      )
      await useStudioStore.getState().sendMessage('first claim about')
      expect(useStudioStore.getState().chat[1].citations?.length).toBeGreaterThan(0)

      useStudioStore.getState().addClaim(
        makeClaim({ id: 'c-cache-2', entityId: 'e-claims', statement: 'second claim content' }),
      )
      await useStudioStore.getState().sendMessage('second claim')
      const citations = useStudioStore.getState().chat[3].citations ?? []
      expect(citations.some((c) => c.entityId === 'e-claims')).toBe(true)
    })

    it('refreshes citations after an entity is updated in place', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-edit-cache', name: 'Cache Edit', description: 'beforetoken' }),
      )
      await useStudioStore.getState().sendMessage('beforetoken')
      expect(useStudioStore.getState().chat[1].citations?.[0].entityId).toBe('e-edit-cache')

      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-edit-cache', name: 'Cache Edit', description: 'aftertoken' }),
      )
      await useStudioStore.getState().sendMessage('aftertoken')
      expect(useStudioStore.getState().chat[3].citations?.[0].entityId).toBe('e-edit-cache')
    })

    it('removes entity citations after deletion', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-delete-cache', name: 'Cache Delete', description: 'deletetoken' }),
      )
      await useStudioStore.getState().sendMessage('deletetoken')
      expect(useStudioStore.getState().chat[1].citations?.[0].entityId).toBe('e-delete-cache')

      useStudioStore.getState().deleteEntity('e-delete-cache')
      await useStudioStore.getState().sendMessage('deletetoken')
      expect(useStudioStore.getState().chat[3].citations).toEqual([])
    })

    it('refreshes citations after a claim is updated', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-claim-edit', name: 'Claim Edit', description: 'claim parent' }),
      )
      useStudioStore.getState().addClaim(
        makeClaim({ entityId: 'e-claim-edit', statement: 'beforeclaim' }),
      )
      const editedClaimId = useStudioStore.getState().claims
        .find((claim) => claim.statement === 'beforeclaim')?.id
      if (!editedClaimId) throw new Error('Claim update fixture was not created')
      await useStudioStore.getState().sendMessage('beforeclaim')
      expect(useStudioStore.getState().chat[1].citations).toEqual([
        expect.objectContaining({
          entityId: 'e-claim-edit',
          snippet: expect.stringContaining('beforeclaim'),
        }),
      ])

      useStudioStore.getState().updateClaim(editedClaimId, { statement: 'afterclaim' })
      const updatedState = useStudioStore.getState()
      expect(updatedState.claims.find((claim) => claim.id === editedClaimId)?.statement).toBe('afterclaim')
      expect(search(updatedState.entities, updatedState.claims, 'afterclaim').some(
        (result) => result.entityId === 'e-claim-edit',
      )).toBe(true)
      await useStudioStore.getState().sendMessage('afterclaim')
      expect(useStudioStore.getState().chat.at(-1)?.citations).toEqual([
        expect.objectContaining({
          entityId: 'e-claim-edit',
          snippet: expect.stringContaining('afterclaim'),
        }),
      ])
    })

    it('removes claim citations after deletion', async () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-claim-delete', name: 'Claim Delete', description: 'claim parent' }),
      )
      useStudioStore.getState().addClaim(
        makeClaim({ entityId: 'e-claim-delete', statement: 'claimdeletetoken' }),
      )
      const deletedClaimId = useStudioStore.getState().claims
        .find((claim) => claim.statement === 'claimdeletetoken')?.id
      if (!deletedClaimId) throw new Error('Claim deletion fixture was not created')
      await useStudioStore.getState().sendMessage('claimdeletetoken')
      expect(useStudioStore.getState().chat[1].citations).toEqual([
        expect.objectContaining({
          entityId: 'e-claim-delete',
          snippet: expect.stringContaining('claimdeletetoken'),
        }),
      ])
      useStudioStore.getState().deleteClaim(deletedClaimId)
      const updatedState = useStudioStore.getState()
      expect(updatedState.claims.some((claim) => claim.id === deletedClaimId)).toBe(false)
      expect(search(updatedState.entities, updatedState.claims, 'claimdeletetoken')).toEqual([])
      await useStudioStore.getState().sendMessage('claimdeletetoken')
      expect(useStudioStore.getState().chat.at(-1)?.citations).toEqual([])
    })


  })
})
