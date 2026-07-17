import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getYjsEntities,
  getYjsClaims,
  setYjsEntity,
  removeYjsEntity,
  setYjsClaim,
  removeYjsClaim,
  mergeIntoYjs,
} from './bridge'
import { destroy } from './doc'
import type { Entity, Claim } from '@/lib/studio/types'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'entity-1',
    name: 'Test Entity',
    type: 'concept',
    description: 'A test entity',
    content: 'Some content',
    tags: ['tag1'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    links: [],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    entityId: 'entity-1',
    statement: 'Test claim',
    confidence: 0.9,
    verification: 'verified',
    ...overrides,
  }
}

beforeEach(() => {
  destroy()
})

afterEach(() => {
  destroy()
})

describe('getYjsEntities / getYjsClaims', () => {
  it('returns empty arrays initially', () => {
    expect(getYjsEntities()).toEqual([])
    expect(getYjsClaims()).toEqual([])
  })
})

describe('setYjsEntity / removeYjsEntity', () => {
  it('adds and retrieves entity', () => {
    const entity = makeEntity()
    setYjsEntity(entity)
    const entities = getYjsEntities()
    expect(entities).toHaveLength(1)
    expect(entities[0].id).toBe('entity-1')
    expect(entities[0].name).toBe('Test Entity')
  })

  it('updates existing entity', () => {
    const entity = makeEntity()
    setYjsEntity(entity)
    setYjsEntity({ ...entity, name: 'Updated Entity' })
    const entities = getYjsEntities()
    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Updated Entity')
  })

  it('removes entity', () => {
    setYjsEntity(makeEntity())
    removeYjsEntity('entity-1')
    expect(getYjsEntities()).toEqual([])
  })
})

describe('setYjsClaim / removeYjsClaim', () => {
  it('adds and retrieves claim', () => {
    const claim = makeClaim()
    setYjsClaim(claim)
    const claims = getYjsClaims()
    expect(claims).toHaveLength(1)
    expect(claims[0].id).toBe('claim-1')
  })

  it('removes claim', () => {
    setYjsClaim(makeClaim())
    removeYjsClaim('claim-1')
    expect(getYjsClaims()).toEqual([])
  })
})

describe('mergeIntoYjs', () => {
  it('merges new entities', () => {
    const entity = makeEntity()
    mergeIntoYjs([entity], [])
    expect(getYjsEntities()).toHaveLength(1)
  })

  it('updates entities with newer timestamps', () => {
    const old = makeEntity({ name: 'Old', updatedAt: '2026-01-01T00:00:00Z' })
    setYjsEntity(old)

    const updated = makeEntity({ name: 'New', updatedAt: '2026-01-02T00:00:00Z' })
    mergeIntoYjs([updated], [])

    const entities = getYjsEntities()
    expect(entities[0].name).toBe('New')
  })

  it('keeps existing entity when it is newer', () => {
    const newer = makeEntity({ name: 'Newer', updatedAt: '2026-01-03T00:00:00Z' })
    setYjsEntity(newer)

    const older = makeEntity({ name: 'Older', updatedAt: '2026-01-01T00:00:00Z' })
    mergeIntoYjs([older], [])

    const entities = getYjsEntities()
    expect(entities[0].name).toBe('Newer')
  })

  it('merges new claims', () => {
    const claim = makeClaim()
    mergeIntoYjs([], [claim])
    expect(getYjsClaims()).toHaveLength(1)
  })
})
