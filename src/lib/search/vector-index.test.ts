import { describe, it, expect } from 'vitest'
import { normalizeVector, cosineSimilarity, VectorStore } from './vector-index'

describe('normalizeVector', () => {
  it('normalizes to unit length', () => {
    const normalized = normalizeVector([3, 4])
    expect(Math.hypot(...normalized)).toBeCloseTo(1)
  })

  it('returns a copy for the zero vector instead of NaN', () => {
    expect(normalizeVector([0, 0])).toEqual([0, 0])
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })
})

describe('VectorStore', () => {
  it('indexes and reports size', () => {
    const store = new VectorStore()
    store.upsert({ id: 'd1', type: 'entity', name: 'Doc', fullText: 'hello' }, [1, 0])
    expect(store.size).toBe(1)
    expect(store.has('d1')).toBe(true)
  })

  it('handles corrupt zero vectors without NaN ranking', () => {
    const store = new VectorStore()
    store.upsert({ id: 'd1', type: 'entity', name: 'Doc', fullText: 'hello' }, [0, 0])
    const results = store.search([1, 0], 5)
    expect(results.every((r) => Number.isFinite(r.score))).toBe(true)
  })
})
