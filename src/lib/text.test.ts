import { describe, it, expect } from 'vitest'
import { truncateGraphemes } from './text'

describe('truncateGraphemes', () => {
  it('returns empty string for falsy input', () => {
    expect(truncateGraphemes('', 10)).toBe('')
  })

  it('does not truncate text within maxGraphemes limit', () => {
    expect(truncateGraphemes('Hello World', 20)).toBe('Hello World')
    expect(truncateGraphemes('Short', 5)).toBe('Short')
  })

  it('truncates standard ASCII text when exceeding limit', () => {
    expect(truncateGraphemes('Hello World Today', 10)).toBe('Hello Wor…')
  })

  it('handles multi-byte and emoji graphemes without splitting surrogates', () => {
    // 👨‍👩‍👧‍👦 is 1 grapheme cluster (family emoji)
    const textWithEmojis = '👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦'
    const truncated = truncateGraphemes(textWithEmojis, 3)
    expect(truncated).toBe('👨‍👩‍👧‍👦👨‍👩‍👧‍👦…')
  })

  it('truncates graph labels (max 24) safely', () => {
    const longLabel = 'This is a very long graph node label that exceeds limits'
    const truncated = truncateGraphemes(longLabel, 24)
    expect(truncated).toBe('This is a very long gra…')
  })

  it('truncates TRIZ labels (max 12) safely', () => {
    const longParam = 'Temperature / Thermal Expansion'
    const truncated = truncateGraphemes(longParam, 12)
    expect(truncated).toBe('Temperature…')
  })
})
