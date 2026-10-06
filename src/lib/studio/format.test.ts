import { describe, it, expect } from 'vitest'
import {
  shortDate,
  fullDate,
  longDate,
  timeOfDay,
  relativeTime,
} from './format'

describe('format', () => {
  const testDate = new Date('2026-03-05T14:30:00.000Z')

  it('formats shortDate correctly', () => {
    const formatted = shortDate.format(testDate)
    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('formats fullDate correctly', () => {
    const formatted = fullDate.format(testDate)
    expect(formatted).toBeDefined()
    expect(formatted).toContain('2026')
  })

  it('formats longDate correctly', () => {
    const formatted = longDate.format(testDate)
    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('formats timeOfDay correctly', () => {
    const formatted = timeOfDay.format(testDate)
    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('formats relativeTime correctly', () => {
    const formatted = relativeTime.format(-2, 'hour')
    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
  })
})
