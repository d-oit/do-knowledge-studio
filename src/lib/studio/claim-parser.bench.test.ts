import { describe, expect, it } from 'vitest'
import { hasExtractableClaims } from './claim-parser'

const CLAIM_PARSE_MS_CEILING = 500

describe('hasExtractableClaims benchmark', () => {
  it('keeps plain-text and large-document scans within the smoke ceiling', () => {
    const plainText = 'This is a long document with no assertions. '.repeat(1000)
    const startPlain = performance.now()
    for (let iteration = 0; iteration < 500; iteration += 1) {
      hasExtractableClaims(plainText)
    }
    const durationPlain = performance.now() - startPlain

    const largeDoc = 'Assertion: First valid claim (Source: source 1)\n' +
      Array.from({ length: 500 }, (_, index) => `Assertion: Claim ${index} (Source: s${index})`).join('\n')
    const startDoc = performance.now()
    for (let iteration = 0; iteration < 500; iteration += 1) {
      hasExtractableClaims(largeDoc)
    }
    const durationDoc = performance.now() - startDoc

    expect(durationPlain).toBeLessThan(CLAIM_PARSE_MS_CEILING)
    expect(durationDoc).toBeLessThan(CLAIM_PARSE_MS_CEILING)
  })
})
