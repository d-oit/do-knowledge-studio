import { describe, it, expect } from 'vitest'
import { runMigrations, CURRENT_SCHEMA_VERSION } from './migrations'

describe('runMigrations', () => {
  it('returns null for non-object input', () => {
    expect(runMigrations(null)).toBeNull()
    expect(runMigrations(undefined)).toBeNull()
    expect(runMigrations('string')).toBeNull()
    expect(runMigrations(42)).toBeNull()
  })

  it('returns null for empty object', () => {
    expect(runMigrations({})).toBeNull()
  })

  it('migrates v1 state with missing claim fields', () => {
    const v1State = {
      version: 1,
      entities: [],
      claims: [
        { id: 'c1', entityId: 'e1', statement: 'Test', confidence: 0.8, verification: 'unverified' },
      ],
    }

    const result = runMigrations(v1State)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result!.claims[0].createdAt).toBeDefined()
    expect(result!.claims[0].updatedAt).toBeDefined()
    expect(result!.claims[0].version).toBe(1)
    expect(result!.claims[0].editHistory).toEqual([])
  })

  it('migrates v1 state with missing entity timestamps', () => {
    const v1State = {
      version: 1,
      entities: [
        { id: 'e1', name: 'Test', type: 'note', description: 'Desc', content: 'Content' },
      ],
      claims: [],
    }

    const result = runMigrations(v1State)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result!.entities[0].createdAt).toBeDefined()
    expect(result!.entities[0].updatedAt).toBeDefined()
  })

  it('migrates v1 state with missing entity tags and links', () => {
    const v1State = {
      version: 1,
      entities: [
        { id: 'e1', name: 'Test', type: 'note', description: 'Desc', content: 'Content', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
      claims: [],
    }

    const result = runMigrations(v1State)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result!.entities[0].tags).toEqual([])
    expect(result!.entities[0].links).toEqual([])
  })

  it('preserves existing data during migration', () => {
    const v1State = {
      version: 1,
      entities: [
        { id: 'e1', name: 'Test', type: 'note', description: 'Desc', content: 'Content', createdAt: '2026-01-01', updatedAt: '2026-01-01', tags: ['tag1'], links: [{ targetId: 'e2', relation: 'related' }] },
      ],
      claims: [
        { id: 'c1', entityId: 'e1', statement: 'Test', confidence: 0.8, verification: 'unverified', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1, editHistory: [] },
      ],
    }

    const result = runMigrations(v1State)
    expect(result).not.toBeNull()
    expect(result!.entities[0].name).toBe('Test')
    expect(result!.entities[0].tags).toEqual(['tag1'])
    expect(result!.entities[0].links).toEqual([{ targetId: 'e2', relation: 'related' }])
    expect(result!.claims[0].statement).toBe('Test')
    expect(result!.claims[0].createdAt).toBe('2026-01-01')
  })

  it('handles state with no version field (v1 default)', () => {
    const stateNoVersion = {
      entities: [],
      claims: [],
    }

    const result = runMigrations(stateNoVersion)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('handles state with current version (no migration needed)', () => {
    const currentState = {
      version: CURRENT_SCHEMA_VERSION,
      entities: [],
      claims: [],
    }

    const result = runMigrations(currentState)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('rejects state with version higher than current (ADR 028 §4)', () => {
    const futureState = {
      version: CURRENT_SCHEMA_VERSION + 1,
      entities: [],
      claims: [],
    }

    const result = runMigrations(futureState)
    expect(result).toBeNull()
  })

  it('rejects when the envelope version argument is higher than current', () => {
    const result = runMigrations({ entities: [], claims: [] }, CURRENT_SCHEMA_VERSION + 1)
    expect(result).toBeNull()
  })

  it('prefers the explicit envelope version over a stale inner stamp', () => {
    // Legacy envelopes stamped `version` inside the state after a migration
    // ran; zustand's authoritative version lives outside. A v1 inner stamp
    // with an envelope version of CURRENT must skip the chain entirely.
    const state = {
      version: 1,
      entities: [{ id: 'e1', name: 'Test', type: 'note', description: '', content: '' }],
      claims: [{ id: 'c1', entityId: 'e1', statement: 'S', confidence: 0.5, verification: 'unverified' }],
    }

    const result = runMigrations(state, CURRENT_SCHEMA_VERSION)
    expect(result).not.toBeNull()
    // The v1→v2 claim backfill never ran, proving the chain was skipped.
    expect(result!.claims[0].createdAt).toBeUndefined()
  })

  it('migrates from the envelope version when it is lower than current', () => {
    const result = runMigrations({ entities: [], claims: [] }, 1)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('returns null if migration throws', () => {
    const invalidState = {
      version: 1,
      entities: 'not-an-array',
      claims: [],
    }

    const result = runMigrations(invalidState)
    expect(result).toBeNull()
  })
})

describe('CURRENT_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true)
  })
})
