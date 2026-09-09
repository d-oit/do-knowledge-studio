import { describe, it, expect } from 'vitest'
import { extractClaimsFromText, hasExtractableClaims } from './claim-parser'

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
    const blocked = 'Assertion: X ' + '('.repeat(50) + ' (Source: leading parens)'
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
  })
})