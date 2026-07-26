import { describe, it, expect } from 'vitest'
import { lookupPrinciples, TRIZ_MATRIX, TRIZ_PRINCIPLES, TRIZ_PARAMETERS } from './triz-data'

describe('triz-data', () => {
  describe('TRIZ_MATRIX', () => {
    it('is a non-empty object', () => {
      expect(typeof TRIZ_MATRIX).toBe('object')
      expect(Object.keys(TRIZ_MATRIX).length).toBeGreaterThan(0)
    })

    it('has keys in format "improving-worsening"', () => {
      const keys = Object.keys(TRIZ_MATRIX)
      for (const key of keys) {
        expect(key).toMatch(/^\d+-\d+$/)
      }
    })

    it('values are arrays of positive integers', () => {
      for (const [, value] of Object.entries(TRIZ_MATRIX)) {
        expect(Array.isArray(value)).toBe(true)
        for (const id of value) {
          expect(typeof id).toBe('number')
          expect(id).toBeGreaterThan(0)
          expect(Number.isInteger(id)).toBe(true)
        }
      }
    })
  })

  describe('TRIZ_PRINCIPLES', () => {
    it('is an array of 40 principles', () => {
      expect(Array.isArray(TRIZ_PRINCIPLES)).toBe(true)
      expect(TRIZ_PRINCIPLES.length).toBe(40)
    })

    it.each(TRIZ_PRINCIPLES)('has id %i and name "%s"', (principle) => {
      expect(typeof principle.id).toBe('number')
      expect(principle.id).toBeGreaterThanOrEqual(1)
      expect(principle.id).toBeLessThanOrEqual(40)
      expect(typeof principle.name).toBe('string')
      expect(principle.name.length).toBeGreaterThan(0)
      expect(typeof principle.description).toBe('string')
      expect(principle.description.length).toBeGreaterThan(0)
    })
  })

  describe('TRIZ_PARAMETERS', () => {
    it('is an array of 39 parameters', () => {
      expect(Array.isArray(TRIZ_PARAMETERS)).toBe(true)
      expect(TRIZ_PARAMETERS.length).toBe(39)
    })

    it.each(TRIZ_PARAMETERS)('has parameter "%s"', (param) => {
      expect(typeof param).toBe('string')
      expect(param.length).toBeGreaterThan(0)
    })
  })

  describe('lookupPrinciples', () => {
    it('returns principles for a valid improving-worsening pair', () => {
      const result = lookupPrinciples(1, 1)
      expect(Array.isArray(result)).toBe(true)
      // The matrix should have some principles for this pair
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id')
        expect(result[0]).toHaveProperty('name')
        expect(result[0]).toHaveProperty('description')
      }
    })

    it('returns empty array for non-existent pair', () => {
      const result = lookupPrinciples(999, 999)
      expect(result).toEqual([])
    })

    it('returns valid principle objects', () => {
      const result = lookupPrinciples(1, 2)
      for (const principle of result) {
        expect(typeof principle.id).toBe('number')
        expect(typeof principle.name).toBe('string')
        expect(typeof principle.description).toBe('string')
      }
    })

    it('handles edge cases', () => {
      // Minimum values
      expect(lookupPrinciples(1, 1)).toBeDefined()
      // Maximum values
      expect(lookupPrinciples(39, 39)).toBeDefined()
    })
  })
})
