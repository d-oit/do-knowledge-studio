import { describe, it, expect } from 'vitest'
import { seedEntities, seedClaims } from './seed-data'

describe('seed data integrity', () => {
  it('has unique entity ids', () => {
    const ids = seedEntities.map((e) => e.id)
    expect(new Set(ids).size).toBe(seedEntities.length)
  })

  it('has unique claim ids', () => {
    const ids = seedClaims.map((c) => c.id)
    expect(new Set(ids).size).toBe(seedClaims.length)
  })

  it('every claim references an existing entity', () => {
    const entityIds = new Set(seedEntities.map((e) => e.id))
    for (const claim of seedClaims) {
      expect(entityIds.has(claim.entityId), `Claim ${claim.id} references missing entity ${claim.entityId}`).toBe(true)
    }
  })

  it('every entity has a valid type', () => {
    const validTypes = new Set(['note', 'concept', 'person', 'project'])
    for (const entity of seedEntities) {
      expect(validTypes.has(entity.type), `Entity ${entity.id} has invalid type ${entity.type}`).toBe(true)
    }
  })

  it('every entity has non-empty name', () => {
    for (const entity of seedEntities) {
      expect(entity.name.trim().length).toBeGreaterThan(0)
    }
  })

  it('entities with links reference existing target entities', () => {
    const entityIds = new Set(seedEntities.map((e) => e.id))
    for (const entity of seedEntities) {
      for (const link of entity.links) {
        expect(entityIds.has(link.targetId), `Entity ${entity.id} links to missing ${link.targetId}`).toBe(true)
      }
    }
  })

  it('claim confidence is within bounds', () => {
    for (const claim of seedClaims) {
      expect(claim.confidence).toBeGreaterThanOrEqual(0)
      expect(claim.confidence).toBeLessThanOrEqual(1)
    }
  })
})