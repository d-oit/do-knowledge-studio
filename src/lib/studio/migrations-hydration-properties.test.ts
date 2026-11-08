import { afterEach, describe, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { makePropertyClaim, makePropertyEntity } from '@/test/property-test-fixtures'
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations'
import { hydrateWithOutcome, sanitizeHydration } from './hydration'
import { QUARANTINE_KEY, quarantinePayload, readQuarantine } from './hydration-quarantine'
import { buildSeedState } from './seed-state'
import type { Claim, Entity } from './types'
import { getPropertyTestParameters, getPropertyTestTimeoutMs } from '@/test/property-test-config'

const MAX_PROPERTY_ID_LENGTH = 18
const MAX_PROPERTY_RECORDS = 4
const MAX_PROPERTY_TEXT_LENGTH = 24
const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z'
const INVALID_ENTITY_ID = 'corrupt-entity'
const ALTERNATE_INVALID_ENTITY_ID = 'corrupt-entity-2'

const validEntityArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_ID_LENGTH }),
  name: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
}).map(({ id, name }) => makePropertyEntity({
  id,
  name,
  createdAt: FIXED_TIMESTAMP,
  updatedAt: FIXED_TIMESTAMP,
  links: [],
}))

const validClaimArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_ID_LENGTH }),
  statement: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
}).map(({ id, statement }) => makePropertyClaim({
  id,
  entityId: 'legacy-parent',
  statement,
  createdAt: FIXED_TIMESTAMP,
  updatedAt: FIXED_TIMESTAMP,
  version: 1,
  editHistory: [],
}))

const legacyEntity = (entity: Entity, version: number): Record<string, unknown> => {
  if (version >= CURRENT_SCHEMA_VERSION) return { ...entity }
  const { links: _links, ...withoutLinks } = entity
  if (version === CURRENT_SCHEMA_VERSION - 1) return withoutLinks
  const { tags: _tags, ...withoutTags } = withoutLinks
  if (version === CURRENT_SCHEMA_VERSION - 2) return withoutTags
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...versionOneEntity } = withoutTags
  return versionOneEntity
}

const legacyClaim = (claim: Claim, version: number): Record<string, unknown> => {
  if (version > 1) return { ...claim }
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    version: _version,
    editHistory: _editHistory,
    ...versionOneClaim
  } = claim
  return versionOneClaim
}

const legacyEnvelopeArbitrary = fc.record({
  version: fc.integer({ min: 1, max: CURRENT_SCHEMA_VERSION }),
  entityIds: fc.uniqueArray(fc.string({ minLength: 1, maxLength: MAX_PROPERTY_ID_LENGTH }), {
    maxLength: MAX_PROPERTY_RECORDS,
  }),
  claimIds: fc.uniqueArray(fc.string({ minLength: 1, maxLength: MAX_PROPERTY_ID_LENGTH }), {
    maxLength: MAX_PROPERTY_RECORDS,
  }),
  entityName: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
  claimStatement: fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH }),
}).map(({ version, entityIds, claimIds, entityName, claimStatement }) => {
  const entities = entityIds.map((id) => legacyEntity(makePropertyEntity({
    id,
    name: entityName,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  }), version))
  const claims = claimIds.map((id) => legacyClaim(makePropertyClaim({
    id,
    entityId: entityIds[0] ?? 'legacy-parent',
    statement: claimStatement,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    version: 1,
    editHistory: [],
  }), version))
  return { version, entities, claims }
})

const corruptedEnvelopeArbitrary = fc.record({
  validEntity: validEntityArbitrary,
  validClaim: validClaimArbitrary,
  invalidName: fc.constant(''),
}).map(({ validEntity, validClaim, invalidName }) => {
  const invalidEntityId = validEntity.id === INVALID_ENTITY_ID
    ? ALTERNATE_INVALID_ENTITY_ID
    : INVALID_ENTITY_ID
  return {
    entities: [validEntity, { ...validEntity, id: invalidEntityId, name: invalidName }],
    claims: [validClaim],
  }
})

afterEach(() => {
  localStorage.removeItem(QUARANTINE_KEY)
})

describe('migration and hydration properties', () => {
  test.prop([legacyEnvelopeArbitrary], getPropertyTestParameters())(
    'legacy migrations preserve entity and claim identities and counts',
    (envelope) => {
      const migrated = runMigrations(envelope, envelope.version)
      expect(migrated).not.toBeNull()
      if (!migrated) throw new Error('Generated legacy envelope did not migrate')
      expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
      expect(migrated.entities.map((entity) => entity.id)).toEqual(
        envelope.entities.map((entity) => entity.id),
      )
      expect(migrated.claims.map((claim) => claim.id)).toEqual(
        envelope.claims.map((claim) => claim.id),
      )
      expect(migrated.entities).toHaveLength(envelope.entities.length)
      expect(migrated.claims).toHaveLength(envelope.claims.length)
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([corruptedEnvelopeArbitrary], getPropertyTestParameters())(
    'a corrupted envelope is rejected atomically and its exact bytes are quarantined',
    (envelope) => {
      const current = {
        ...buildSeedState(),
        tagQuery: '',
        hasDescriptionOnly: false,
        viewMode: 'grid' as const,
        showAll: false,
        graphViews: [],
        proposals: [],
        entityHistory: [],
        historyIndex: 0,
      }
      const currentEntities = current.entities
      const currentClaims = current.claims
      const sanitized = sanitizeHydration(envelope)
      const outcome = hydrateWithOutcome(envelope, current)
      expect(sanitized.ok).toBe(false)
      expect(sanitized.data).toEqual({})
      expect(outcome.ok).toBe(false)
      if (outcome.ok) throw new Error('Generated corrupted envelope was accepted')
      expect(current.entities).toBe(currentEntities)
      expect(current.claims).toBe(currentClaims)

      const rawEnvelope = JSON.stringify({ state: envelope, version: CURRENT_SCHEMA_VERSION })
      localStorage.removeItem(QUARANTINE_KEY)
      try {
        expect(quarantinePayload(outcome.reason, rawEnvelope)).toBe(true)
        expect(readQuarantine()?.raw).toBe(rawEnvelope)
      } finally {
        localStorage.removeItem(QUARANTINE_KEY)
      }
    },
    getPropertyTestTimeoutMs(),
  )
})
