import { describe, expect, it } from 'vitest'
import {
  MAX_CACHE_ENTRIES,
  getEntityMap,
  resetSearchCache,
  search,
  type PwaClaimLike,
  type PwaEntityLike,
} from './pwa-retrieval.js'

const entities: PwaEntityLike[] = [
  { id: 'e1', name: 'Alpha', type: 'concept', description: 'First project', content: 'alpha body about graphs', tags: ['research'] },
  { id: 'e2', name: 'Beta', type: 'concept', description: '', content: 'plain beta text', tags: [] },
  { id: 'e3', name: 'Gamma', type: 'concept', description: '', content: 'unrelated gamma content', tags: [] },
]

const claims: PwaClaimLike[] = [
  { id: 'c1', entityId: 'e1', statement: 'Alpha scales linearly', evidence: 'Paper', source: 'https://example.com' },
]

describe('pwa-retrieval search', () => {
  it('ranks name matches above body matches deterministically', () => {
    const results = search(entities, claims, 'alpha', 10)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.id).toBe('e1')
  })

  it('searches claim statements', () => {
    const results = search(entities, claims, 'scales', 10)
    expect(results.some((r) => r.type === 'claim' && r.entityId === 'e1')).toBe(true)
  })

  it('is stop-word aware', () => {
    expect(search(entities, claims, 'the', 10)).toHaveLength(0)
  })

  it('preserves the PWA stop-word list: "the" indexes, question words do not', () => {
    // Discriminating corpus — both documents contain the literal words.
    // The old (main) list filters question words like "how" from the index
    // but keeps "the"; the generic swap flagged in review inverts both.
    const words: PwaEntityLike[] = [
      { id: 'w1', name: 'Notes', type: 'note', description: '', content: 'the plan shows how the graph scales', tags: [] },
    ]
    expect(search(words, [], 'the', 10).map((r) => r.id)).toEqual(['w1'])
    expect(search(words, [], 'how', 10)).toHaveLength(0)
  })

  it('returns snippets bounded to 140 chars', () => {
    const big: PwaEntityLike[] = [
      { id: 'big', name: 'X'.repeat(200), type: 'note', description: '', content: 'y'.repeat(400), tags: [] },
    ]
    const results = search(big, [], 'x', 1)
    expect(results[0]?.snippet.length).toBeLessThanOrEqual(141)
  })

  it('supports filters narrowing candidates before ranking', () => {
    const results = search(entities, claims, 'alpha', 10, (doc) => doc.type === 'claim')
    expect(results.every((r) => r.type === 'claim')).toBe(true)
  })

  it('respects the limit', () => {
    const results = search(entities, claims, 'a', 1)
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('clears caches via resetSearchCache', () => {
    resetSearchCache()
    const before = getEntityMap(entities, claims)
    expect(before.has('e1')).toBe(true)
    resetSearchCache()
    expect(MAX_CACHE_ENTRIES).toBeGreaterThan(0)
  })
})
