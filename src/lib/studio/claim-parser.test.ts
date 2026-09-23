import { describe, it, expect } from 'vitest'
import { extractClaimsFromText, hasExtractableClaims } from './claim-parser'

// Smoke guard, not a micro-benchmark. The plain-text loop returns on a single
// regex probe and the large-document loop stops parsing after the first
// assertion, so both finish in single-digit milliseconds on a quiet machine.
// This file runs alongside 150+ others, and CPU saturation has pushed comparable
// measurements past 180ms (see the ceiling note in src/lib/ai/context.test.ts),
// so the wide margin keeps the assertion about parser behaviour rather than host
// scheduling, and still catches an order-of-magnitude regression.
const CLAIM_PARSE_MS_CEILING = 500

describe('extractClaimsFromText', () => {
  it('extracts a single assertion with a source', () => {
    expect(extractClaimsFromText('Assertion: Water boils at 100C (Source: physics textbook)')).toEqual([
      { statement: 'Water boils at 100C', source: 'physics textbook' },
    ])
  })

  it('extracts an assertion without a source', () => {
    expect(extractClaimsFromText('Assertion: Beethoven was deaf')).toEqual([
      { statement: 'Beethoven was deaf' },
    ])
  })

  it('extracts multiple assertions across the text', () => {
    const text = [
      'Assertion: First claim (Source: A)',
      'Assertion: Second claim (Source: B)',
      'Assertion: Third claim',
    ].join('\n')
    expect(extractClaimsFromText(text)).toEqual([
      { statement: 'First claim', source: 'A' },
      { statement: 'Second claim', source: 'B' },
      { statement: 'Third claim' },
    ])
  })

  it('extracts multiple assertions on a single line', () => {
    expect(extractClaimsFromText('Assertion: One Assertion: Two')).toEqual([
      { statement: 'One' },
      { statement: 'Two' },
    ])
  })

  it('supports statements spanning multiple lines', () => {
    expect(extractClaimsFromText('Assertion: The first line\ncontinues here (Source: book)')).toEqual([
      { statement: 'The first line\ncontinues here', source: 'book' },
    ])
  })

  it('matches assertion and source markers case-insensitively', () => {
    expect(extractClaimsFromText('aSsErTiOn: Case test (sOuRcE: mixed case)')).toEqual([
      { statement: 'Case test', source: 'mixed case' },
    ])
  })

  it('tolerates whitespace around markers', () => {
    expect(
      extractClaimsFromText('  Assertion  :   padded statement   (  Source : trailing )  '),
    ).toEqual([{ statement: 'padded statement', source: 'trailing' }])
  })

  it('keeps parentheses inside the statement', () => {
    expect(extractClaimsFromText('Assertion: Carbon (C) has six protons (Source: chemistry notes)')).toEqual([
      { statement: 'Carbon (C) has six protons', source: 'chemistry notes' },
    ])
  })

  it('handles nested parentheses inside the source group', () => {
    expect(extractClaimsFromText('Assertion: X (Source: see figure (b))')).toEqual([
      { statement: 'X', source: 'see figure (b)' },
    ])
  })

  it('uses the last parenthesized group that starts with Source:', () => {
    expect(extractClaimsFromText('Assertion: X (Source: draft) (Source: final)')).toEqual([
      { statement: 'X (Source: draft)', source: 'final' },
    ])
  })

  it('does not treat a trailing group as a source unless it starts with Source:', () => {
    expect(extractClaimsFromText('Assertion: X (not a source)')).toEqual([
      { statement: 'X (not a source)' },
    ])
  })

  it('handles unmatched open parens linearly without breaking source detection', () => {
    // Regression: many unbalanced `(` before a valid Source group must not
    // defeat detection nor degrade to quadratic rescans.
    const blocked = `Assertion: X ${'('.repeat(50)} (Source: leading parens)` 
    expect(extractClaimsFromText(blocked)).toEqual([
      { statement: `X ${'('.repeat(50)}`, source: 'leading parens' },
    ])
  })

  it('drops an empty source group', () => {
    expect(extractClaimsFromText('Assertion: Empty source (Source: )')).toEqual([
      { statement: 'Empty source' },
    ])
  })

  it('trims trailing whitespace before the source group', () => {
    expect(extractClaimsFromText('Assertion: padded  \n (Source: src)')).toEqual([
      { statement: 'padded', source: 'src' },
    ])
  })

  it('dedupes identical statement/source pairs preserving order', () => {
    const text = [
      'Assertion: Same claim (Source: A)',
      'Assertion: Different (Source: A)',
      'Assertion: Same claim (Source: A)',
    ].join('\n')
    expect(extractClaimsFromText(text)).toEqual([
      { statement: 'Same claim', source: 'A' },
      { statement: 'Different', source: 'A' },
    ])
  })

  it('dedupes source-less claims by statement', () => {
    expect(extractClaimsFromText('Assertion: No source claim\nAssertion: No source claim')).toEqual([
      { statement: 'No source claim' },
    ])
  })

  it('returns an empty array for text without assertions', () => {
    expect(extractClaimsFromText('Just a plain note with no structure.')).toEqual([])
    expect(extractClaimsFromText('')).toEqual([])
    expect(extractClaimsFromText('Source: not an assertion')).toEqual([])
  })

  it('ignores malformed or incomplete Assertion blocks', () => {
    expect(extractClaimsFromText('Assertion:')).toEqual([])
    expect(extractClaimsFromText('Assertion:  ')).toEqual([])
    expect(extractClaimsFromText('Assertion: (Source: only source)')).toEqual([])
    expect(extractClaimsFromText('Assertion: valid one (Source: ok)\nAssertion:')).toEqual([
      { statement: 'valid one', source: 'ok' },
    ])
  })
})

describe('hasExtractableClaims', () => {
  it('is true when at least one assertion parses', () => {
    expect(hasExtractableClaims('Assertion: Yes (Source: A)')).toBe(true)
    expect(hasExtractableClaims('Assertion: Yes')).toBe(true)
  })

  it('is false for plain text and malformed assertions', () => {
    expect(hasExtractableClaims('Nothing here')).toBe(false)
    expect(hasExtractableClaims('')).toBe(false)
    expect(hasExtractableClaims('Assertion:')).toBe(false)
    expect(hasExtractableClaims('Assertion:    ')).toBe(false)
  })

  it('handles malformed initial assertion followed by a valid assertion', () => {
    expect(hasExtractableClaims('Assertion: \nAssertion: Valid statement')).toBe(true)
  })

  it('performance: stays within the smoke-test ceiling for plain text and large documents', () => {
    // This is a regression ceiling, not a proof of early exit.
    // `hasExtractableClaims` still materializes every marker up front — a block's
    // end needs the next marker's index — so the marker scan is O(n) either way.
    // What short-circuits is `parseBlock`, which runs only until the first block
    // parses. Asserting that behaviourally would need an injection point inside
    // the module, which the exported API deliberately does not have.
    const plainText = 'This is a long document with no assertions. '.repeat(1000)
    const startPlain = performance.now()
    for (let i = 0; i < 500; i += 1) {
      hasExtractableClaims(plainText)
    }
    const durationPlain = performance.now() - startPlain

    const largeDoc = 'Assertion: First valid claim (Source: source 1)\n' +
      Array.from({ length: 500 }, (_, i) => `Assertion: Claim ${i} (Source: s${i})`).join('\n')
    const startDoc = performance.now()
    for (let i = 0; i < 500; i += 1) {
      hasExtractableClaims(largeDoc)
    }
    const durationDoc = performance.now() - startDoc

    expect(durationPlain).toBeLessThan(CLAIM_PARSE_MS_CEILING)
    expect(durationDoc).toBeLessThan(CLAIM_PARSE_MS_CEILING)
  })
})