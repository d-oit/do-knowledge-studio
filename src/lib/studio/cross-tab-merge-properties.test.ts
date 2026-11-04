import { afterEach, describe, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { makePropertyClaim, makePropertyEntity } from '@/test/property-test-fixtures'
import { mergeCorpus } from './cross-tab-merge'
import { getDeletions, recordDeletion, resetDeletions } from './cross-tab-tombstones'
import type { Claim, Entity } from './types'
import { getPropertyTestParameters, getPropertyTestTimeoutMs } from '@/test/property-test-config'
import { permutations } from '@/test/property-test-helpers'

const MAX_PROPERTY_TIMESTAMP_MS = Date.parse('2035-12-31T23:59:59.999Z')
const DELETED_ENTITY_ID = 'deleted-parent'
const CHILD_ENTITY_ID = 'child-entity'
const CLAIM_ID = 'child-claim'
const FIXED_CREATED_AT = '2026-01-01T00:00:00.000Z'
const LINK_RELATION = 'related'
const DELETION_ID = 'property-deletion'
const MIN_REPLICA_DELETIONS = 2
const MAX_REPLICA_DELETIONS = 3

const timestampArbitrary = fc.integer({ min: 0, max: MAX_PROPERTY_TIMESTAMP_MS })
  .map((milliseconds) => new Date(milliseconds).toISOString())

const makeDeletedCorpus = (updatedAt: string): { entities: Entity[]; claims: Claim[] } => {
  const deletedEntity = makePropertyEntity({
    id: DELETED_ENTITY_ID,
    name: 'Deleted parent',
    createdAt: FIXED_CREATED_AT,
    updatedAt,
    links: [],
  })
  const child = makePropertyEntity({
    id: CHILD_ENTITY_ID,
    name: 'Child',
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_CREATED_AT,
    links: [{ targetId: DELETED_ENTITY_ID, relation: LINK_RELATION }],
  })
  const claim = makePropertyClaim({
    id: CLAIM_ID,
    entityId: DELETED_ENTITY_ID,
    createdAt: FIXED_CREATED_AT,
    updatedAt,
  })
  return { entities: [deletedEntity, child], claims: [claim] }
}

afterEach(() => resetDeletions())

describe('cross-tab merge properties', () => {
  test.prop([fc.array(timestampArbitrary, {
    minLength: MIN_REPLICA_DELETIONS,
    maxLength: MAX_REPLICA_DELETIONS,
  })], getPropertyTestParameters())(
    'the latest deletion timestamp is independent of two or three replica arrival orders',
    (timestamps) => {
      const results = permutations(timestamps).map((order) => {
        resetDeletions()
        try {
          for (const timestamp of order) recordDeletion('entity', DELETION_ID, Date.parse(timestamp))
          return getDeletions('entity').get(DELETION_ID)
        } finally {
          resetDeletions()
        }
      })
      for (const result of results.slice(1)) expect(result).toBe(results[0])
      expect(results[0]).toBe(Math.max(...timestamps.map((timestamp) => Date.parse(timestamp))))
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([fc.integer({ min: 0, max: MAX_PROPERTY_TIMESTAMP_MS }), fc.integer({ min: 0, max: MAX_PROPERTY_TIMESTAMP_MS })], getPropertyTestParameters())(
    'a stale delete removes linked entities and claims, while a later recreation survives',
    (deletionTime, itemTime) => {
      const updatedAt = new Date(itemTime).toISOString()
      const local = makeDeletedCorpus(updatedAt)
      const remote = makeDeletedCorpus(updatedAt)
      const result = mergeCorpus(
        local.entities,
        local.claims,
        remote.entities,
        remote.claims,
        new Map([[DELETED_ENTITY_ID, deletionTime]]),
        new Map(),
      )
      const recreatedAfterDelete = itemTime > deletionTime
      const parentSurvives = result.entities.some((entity) => entity.id === DELETED_ENTITY_ID)
      const child = result.entities.find((entity) => entity.id === CHILD_ENTITY_ID)
      const childClaimSurvives = result.claims.some((claim) => claim.id === CLAIM_ID)

      expect(parentSurvives).toBe(recreatedAfterDelete)
      expect(childClaimSurvives).toBe(recreatedAfterDelete)
      expect(child?.links.some((link) => link.targetId === DELETED_ENTITY_ID)).toBe(recreatedAfterDelete)
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([fc.integer({ min: 0, max: MAX_PROPERTY_TIMESTAMP_MS })], getPropertyTestParameters())(
    'every retained claim references a surviving parent after entity tombstones apply',
    (deletionTime) => {
      const local = makeDeletedCorpus(FIXED_CREATED_AT)
      const remote = makeDeletedCorpus(FIXED_CREATED_AT)
      const result = mergeCorpus(
        local.entities,
        local.claims,
        remote.entities,
        remote.claims,
        new Map([[DELETED_ENTITY_ID, deletionTime]]),
        new Map(),
      )
      const survivingEntityIds = new Set(result.entities.map((entity) => entity.id))
      expect(result.claims.every((claim) => survivingEntityIds.has(claim.entityId))).toBe(true)
    },
    getPropertyTestTimeoutMs(),
  )
})
