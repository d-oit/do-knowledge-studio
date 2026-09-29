import { describe, it, expect } from 'vitest'
import { buildSeedState } from './seed-state'
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

  it('returns the same defaults every time', () => {
    // The seed baseline is no longer exported: `Readonly<T>` is shallow, so an
    // exported reference to the module-level seed arrays stayed mutable. The
    // values are asserted through buildSeedState, which always hands out a copy.
    const a = buildSeedState()
    const b = buildSeedState()
    expect(a.currentView).toBe('home')
    expect(a.sortBy).toBe('updated')
    expect(a.sortDir).toBe('desc')
    expect(a.entities).toEqual(seedEntities)
    expect(a.entities).not.toBe(b.entities)
  })
})
