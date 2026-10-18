import { beforeEach, describe, expect, it } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { getEntityMap, resetSearchCache } from './retrieval'

const entity: Entity = {
  id: 'entity-1',
  name: 'Retrieval map contract',
  type: 'note',
  description: 'An entity used to verify public lookup behavior.',
  content: 'Retrieval map test content.',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

describe('retrieval entity map', () => {
  beforeEach(() => resetSearchCache())

  it('looks up entities by id, returns undefined for missing ids, and reuses the cached map', () => {
    const entities = [entity]
    const claims: [] = []

    const entityMap = getEntityMap(entities, claims)

    expect(entityMap.get(entity.id)).toBe(entity)
    expect(entityMap.get('missing-entity')).toBeUndefined()
    expect(getEntityMap(entities, claims)).toBe(entityMap)
  })
})
