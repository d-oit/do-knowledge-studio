import type { Claim, Entity } from '@/lib/studio/types'

const PROPERTY_FIXTURE_TIMESTAMP = '2026-01-01T00:00:00.000Z'
const DEFAULT_PROPERTY_CONFIDENCE = 0.5
const DEFAULT_PROPERTY_VERSION = 1

export const makePropertyEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'property-entity',
  name: 'Property entity',
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: PROPERTY_FIXTURE_TIMESTAMP,
  updatedAt: PROPERTY_FIXTURE_TIMESTAMP,
  links: [],
  ...overrides,
})

export const makePropertyClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'property-claim',
  entityId: 'property-entity',
  statement: 'Property claim',
  confidence: DEFAULT_PROPERTY_CONFIDENCE,
  verification: 'unverified',
  createdAt: PROPERTY_FIXTURE_TIMESTAMP,
  updatedAt: PROPERTY_FIXTURE_TIMESTAMP,
  version: DEFAULT_PROPERTY_VERSION,
  editHistory: [],
  ...overrides,
})
