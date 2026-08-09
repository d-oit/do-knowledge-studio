import { describe, it, expect } from 'vitest'
import { trustTier, isStale } from './trust'

describe('OKF Trust Tiers & Staleness Helper', () => {
  describe('trustTier', () => {
    it('returns unverified for missing or empty verifications', () => {
      expect(trustTier()).toBe('unverified')
      expect(trustTier([])).toBe('unverified')
    })

    it('returns machine-confirmed for machine/process verifiers', () => {
      expect(trustTier({ by: 'process:automated-scanner', at: '2026-07-24T00:00:00Z' })).toBe('machine-confirmed')
      expect(trustTier([{ by: 'google-catalog/1.0', at: '2026-07-24T00:00:00Z' }])).toBe('machine-confirmed')
    })

    it('returns human-reviewed if any verifier is human', () => {
      expect(
        trustTier([
          { by: 'process:automated-scanner', at: '2026-07-24T00:00:00Z' },
          { by: 'human:jules', at: '2026-07-24T00:00:00Z' },
        ]),
      ).toBe('human-reviewed')
    })
  })

  describe('isStale', () => {
    it('returns false if stale_after is not provided', () => {
      expect(isStale()).toBe(false)
    })

    it('returns true if today is equal to or after stale_after', () => {
      expect(isStale('2026-07-24', new Date('2026-07-24'))).toBe(true)
      expect(isStale('2026-07-24', new Date('2026-07-25'))).toBe(true)
    })

    it('returns false if today is before stale_after', () => {
      expect(isStale('2026-07-24', new Date('2026-07-23'))).toBe(false)
    })
  })
})
