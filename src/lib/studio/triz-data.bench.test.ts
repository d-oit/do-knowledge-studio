import { describe, expect, it } from 'vitest'
import { lookupPrinciples } from './triz-data'

const TRIZ_MATRIX_LOOKUP_MS_CEILING = 50

describe('TRIZ matrix lookup benchmark', () => {
  it('completes a full matrix lookup within its smoke ceiling', () => {
    const start = performance.now()
    let totalPrinciples = 0
    for (let improving = 1; improving <= 39; improving += 1) {
      for (let worsening = 1; worsening <= 39; worsening += 1) {
        totalPrinciples += lookupPrinciples(improving, worsening).length
      }
    }
    const duration = performance.now() - start

    expect(totalPrinciples).toBeGreaterThan(0)
    expect(duration).toBeLessThan(TRIZ_MATRIX_LOOKUP_MS_CEILING)
  })
})
