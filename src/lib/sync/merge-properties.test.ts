import 'fake-indexeddb/auto'
import { afterEach, describe, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { makePropertyClaim, makePropertyEntity } from '@/test/property-test-fixtures'
import type { Claim, Entity } from '@/lib/studio/types'
import { getPropertyTestParameters, getPropertyTestTimeoutMs } from '@/test/property-test-config'
import { permutations } from '@/test/property-test-helpers'
import { destroyBridge, getYjsClaims, getYjsEntities, mergeIntoYjs } from './bridge'
import { destroy, getDoc, getSyncDoc } from './doc'
import { mergeClaims, mergeEntities } from './merge'
import { claimToYMap, entityToYMap } from './types'
import * as Y from 'yjs'

const MAX_PROPERTY_TEXT_LENGTH = 24
const MAX_PROPERTY_ITEMS = 4
const MAX_PROPERTY_SNAPSHOTS = 3
const MERGE_GROUP_COUNT = 2
const MIN_PROPERTY_SNAPSHOTS = 2
const MAX_PROPERTY_TIMESTAMP_MS = Date.parse('2035-12-31T23:59:59.999Z')
const FIXED_CREATED_AT = '2026-01-01T00:00:00.000Z'
const ENTITY_ID = 'property-entity'
const CLAIM_ID = 'property-claim'
const VALID_SOURCE_URL = 'https://example.com/source'
const REPLICA_DEVICE_IDS = ['replica-a', 'replica-b', 'replica-c'] as const

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0

const timestampArbitrary = fc.integer({ min: 0, max: MAX_PROPERTY_TIMESTAMP_MS })
  .map((milliseconds) => new Date(milliseconds).toISOString())

const entitySnapshotArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
  description: fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }),
  content: fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }),
  sourceUrl: fc.option(fc.constant(VALID_SOURCE_URL), { nil: undefined }),
  tags: fc.uniqueArray(fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }), {
    maxLength: MAX_PROPERTY_ITEMS,
  }),
  linkTargets: fc.uniqueArray(fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }), {
    maxLength: MAX_PROPERTY_ITEMS,
  }),
  updatedAt: timestampArbitrary,
}).map(({ linkTargets, ...data }) => makePropertyEntity({
  id: ENTITY_ID,
  createdAt: FIXED_CREATED_AT,
  links: linkTargets.map((targetId) => ({ targetId: `target-${targetId}`, relation: 'related' })),
  ...data,
}))

const claimSnapshotArbitrary = fc.record({
  statement: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
  evidence: fc.option(fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }), { nil: undefined }),
  source: fc.option(fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }), { nil: undefined }),
  confidencePercent: fc.integer({ min: 0, max: 100 }),
  verification: fc.constantFrom('unverified', 'verified', 'disputed'),
  updatedAt: timestampArbitrary,
  version: fc.integer({ min: 1, max: MAX_PROPERTY_ITEMS }),
  editHistory: fc.uniqueArray(fc.record({
    statement: fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }),
    editedAt: timestampArbitrary,
  }), {
    maxLength: MAX_PROPERTY_ITEMS,
    selector: (entry) => JSON.stringify([entry.editedAt, entry.statement]),
  }),
}).map(({ confidencePercent, editHistory, ...data }) => makePropertyClaim({
  id: CLAIM_ID,
  entityId: ENTITY_ID,
  createdAt: FIXED_CREATED_AT,
  confidence: confidencePercent / 100,
  editHistory: [...editHistory].sort((left, right) =>
    compareText(left.editedAt, right.editedAt) || compareText(left.statement, right.statement),
  ),
  ...data,
}))

const normalizeEntities = (entities: readonly Entity[]): Entity[] => entities
  .map((entity) => ({
    ...entity,
    tags: [...entity.tags].sort(compareText),
    links: entity.links.map((link) => ({ ...link })).sort((left, right) =>
      compareText(left.targetId, right.targetId) || compareText(left.relation, right.relation),
    ),
  }))
  .sort((left, right) => compareText(left.id, right.id))

const normalizeClaims = (claims: readonly Claim[]): Claim[] => claims
  .map((claim) => ({
    ...claim,
    editHistory: (claim.editHistory ?? []).map((entry) => ({ ...entry })).sort((left, right) =>
      compareText(left.editedAt, right.editedAt) || compareText(left.statement, right.statement),
    ),
  }))
  .sort((left, right) => compareText(left.id, right.id))

const baseClock = (counter: number): Record<string, number> => ({ 'base-device': counter })

const makeReplicaUpdate = (
  baseUpdate: Uint8Array,
  baseStateVector: Uint8Array,
  entity: Entity,
  claim: Claim,
  clock: Record<string, number>,
): Uint8Array => {
  const replica = new Y.Doc()
  try {
    Y.applyUpdate(replica, baseUpdate)
    replica.getMap<Record<string, unknown>>('entities').set(entity.id, {
      ...entityToYMap(entity),
      __syncClock: clock,
    })
    replica.getMap<Record<string, unknown>>('claims').set(claim.id, {
      ...claimToYMap(claim),
      __syncClock: clock,
    })
    return Y.encodeStateAsUpdate(replica, baseStateVector)
  } finally {
    replica.destroy()
  }
}

const readReplicaState = (baseUpdate: Uint8Array, updates: readonly Uint8Array[]) => {
  destroyBridge()
  destroy()
  try {
    Y.applyUpdate(getDoc(), baseUpdate)
    for (const update of updates) Y.applyUpdate(getDoc(), update)
    return {
      entities: normalizeEntities(getYjsEntities()),
      claims: normalizeClaims(getYjsClaims()),
    }
  } finally {
    destroyBridge()
    destroy()
  }
}

afterEach(() => {
  destroyBridge()
  destroy()
})

describe('sync merge properties', () => {
  test.prop([entitySnapshotArbitrary], getPropertyTestParameters())(
    'entity merge is idempotent',
    (entity) => {
      const result = mergeEntities([entity], [entity])
      expect(normalizeEntities(result.merged)).toEqual(normalizeEntities([entity]))
      expect(result.conflicts).toEqual([])
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([entitySnapshotArbitrary, entitySnapshotArbitrary], getPropertyTestParameters())(
    'entity field merge is commutative after list-valued fields are canonicalized',
    (left, right) => {
      const forward = mergeEntities([left], [right]).merged
      const reverse = mergeEntities([right], [left]).merged
      expect(normalizeEntities(forward)).toEqual(normalizeEntities(reverse))
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([claimSnapshotArbitrary], getPropertyTestParameters())(
    'claim merge is idempotent',
    (claim) => {
      const result = mergeClaims([claim], [claim])
      expect(normalizeClaims(result.merged)).toEqual(normalizeClaims([claim]))
      expect(result.conflicts).toEqual([])
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([claimSnapshotArbitrary, claimSnapshotArbitrary], getPropertyTestParameters())(
    'claim field merge is commutative',
    (left, right) => {
      const forward = mergeClaims([left], [right]).merged
      const reverse = mergeClaims([right], [left]).merged
      expect(normalizeClaims(forward)).toEqual(normalizeClaims(reverse))
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([entitySnapshotArbitrary, claimSnapshotArbitrary], getPropertyTestParameters())(
    're-merging an unchanged canonical local snapshot preserves causal versions',
    (entity, claim) => {
      destroyBridge()
      destroy()
      try {
        const first = mergeIntoYjs([entity], [claim])
        const entityClock = getSyncDoc().entities.get(entity.id)?.__syncClock
        const claimClock = getSyncDoc().claims.get(claim.id)?.__syncClock
        const second = mergeIntoYjs([entity], [claim])
        expect(second.conflicts).toEqual([])
        expect(normalizeEntities(second.merged.entities)).toEqual(normalizeEntities(first.merged.entities))
        expect(normalizeClaims(second.merged.claims)).toEqual(normalizeClaims(first.merged.claims))
        expect(getSyncDoc().entities.get(entity.id)?.__syncClock).toEqual(entityClock)
        expect(getSyncDoc().claims.get(claim.id)?.__syncClock).toEqual(claimClock)
      } finally {
        destroyBridge()
        destroy()
      }
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([
    fc.array(fc.record({
      name: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
      statement: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
      updatedAt: timestampArbitrary,
      tags: fc.uniqueArray(fc.string({ maxLength: MAX_PROPERTY_TEXT_LENGTH }), {
        maxLength: MAX_PROPERTY_ITEMS,
      }),
    }), { minLength: MIN_PROPERTY_SNAPSHOTS, maxLength: MAX_PROPERTY_SNAPSHOTS }),
    fc.integer({ min: 0, max: MAX_PROPERTY_ITEMS }),
  ], getPropertyTestParameters())(
    'Yjs replica updates converge under every order and associative/idempotent grouping',
    (operations, baseCounter) => {
      const initialEntity = makePropertyEntity({
        id: ENTITY_ID,
        name: 'Base entity',
        createdAt: FIXED_CREATED_AT,
        updatedAt: FIXED_CREATED_AT,
        links: [],
      })
      const initialClaim = makePropertyClaim({
        id: CLAIM_ID,
        entityId: ENTITY_ID,
        statement: 'Base claim',
        createdAt: FIXED_CREATED_AT,
        updatedAt: FIXED_CREATED_AT,
      })
      const initialClock = baseClock(baseCounter)
      const baseDocument = new Y.Doc()
      try {
        baseDocument.getMap<Record<string, unknown>>('entities').set(initialEntity.id, {
          ...entityToYMap(initialEntity),
          __syncClock: initialClock,
        })
        baseDocument.getMap<Record<string, unknown>>('claims').set(initialClaim.id, {
          ...claimToYMap(initialClaim),
          __syncClock: initialClock,
        })
        const baseUpdate = Y.encodeStateAsUpdate(baseDocument)
        const baseStateVector = Y.encodeStateVector(baseDocument)
        const updates = operations.map((operation, index) => {
          const deviceId = REPLICA_DEVICE_IDS[index]
          if (!deviceId) throw new Error(`No replica identity for operation ${index}`)
          const entity = makePropertyEntity({
            id: ENTITY_ID,
            name: operation.name,
            createdAt: FIXED_CREATED_AT,
            updatedAt: operation.updatedAt,
            tags: operation.tags,
            links: [],
          })
          const claim = makePropertyClaim({
            id: CLAIM_ID,
            entityId: ENTITY_ID,
            statement: operation.statement,
            createdAt: FIXED_CREATED_AT,
            updatedAt: operation.updatedAt,
          })
          const clock = {
            ...baseClock(baseCounter),
            [`${deviceId}-entity`]: 1,
            [`${deviceId}-claim`]: 1,
          }
          return makeReplicaUpdate(baseUpdate, baseStateVector, entity, claim, clock)
        })
        const states = permutations(updates).map((orderedUpdates) =>
          readReplicaState(baseUpdate, orderedUpdates),
        )
        const mergedUpdates = [Y.mergeUpdates(updates)]
        if (updates.length === MAX_PROPERTY_SNAPSHOTS) {
          const splitIndex = Math.floor(updates.length / MERGE_GROUP_COUNT)
          const firstGroup = updates.slice(0, splitIndex)
          const lastGroup = updates.slice(splitIndex)
          mergedUpdates.push(
            Y.mergeUpdates([Y.mergeUpdates(firstGroup), ...lastGroup]),
            Y.mergeUpdates([...firstGroup, Y.mergeUpdates(lastGroup)]),
          )
        }
        for (const update of mergedUpdates) states.push(readReplicaState(baseUpdate, [update]))
        states.push(readReplicaState(baseUpdate, [...updates, ...updates]))
        for (const state of states.slice(1)) expect(state).toEqual(states[0])
      } finally {
        baseDocument.destroy()
      }
    },
    getPropertyTestTimeoutMs(),
  )
})
