import { describe, it, expect } from 'vitest'
import { SEED_STATE, buildSeedState } from './seed-state'
import { seedClaims, seedEntities } from './seed-data'

describe('buildSeedState', () => {
  it('returns the same corpus as the shipped seed data', () => {
    const seed = buildSeedState()
    expect(seed.entities).toEqual(seedEntities)
    expect(seed.claims).toEqual(seedClaims)
  })

  it('hands out an independent copy each call', () => {
    const first = buildSeedState()
    first.entities[0].name = 'mutated'
    first.claims[0].statement = 'mutated'

    // A caller mutating its own state must not corrupt the module-level
    // seed arrays every later store initialization reads from.
    const second = buildSeedState()
    expect(second.entities[0].name).not.toBe('mutated')
    expect(second.claims[0].statement).not.toBe('mutated')
    expect(seedEntities[0].name).not.toBe('mutated')
  })

  it('returns a fresh chat array rather than the shared module array', () => {
    const first = buildSeedState()
    const second = buildSeedState()
    expect(first.chat).not.toBe(second.chat)
    expect(first.entities).not.toBe(second.entities)
    expect(first.claims).not.toBe(second.claims)
  })

  it('exposes the seed baseline read-only for comparisons', () => {
    expect(SEED_STATE.entities).toBe(seedEntities)
    expect(SEED_STATE.currentView).toBe('home')
    expect(SEED_STATE.sortBy).toBe('updated')
    expect(SEED_STATE.sortDir).toBe('desc')
  })
})
