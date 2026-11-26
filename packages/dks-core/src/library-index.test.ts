import { describe, expect, it } from 'vitest'
import { LibraryIndex } from './library-index.js'
import { pwaResetSearchCache } from './index.js'
import type { BundleConcept } from './types.js'

/** Builds a concept fixture with overridable fields. */
const concept = (overrides: Partial<BundleConcept> & { id: string; name: string }): BundleConcept => ({
  type: 'Concept',
  description: '',
  content: '',
  tags: [],
  trustTier: 'unverified',
  sources: [],
  claims: [],
  relatedIds: [],
  ...overrides,
})

/** Three-concept library: Alpha links Beta; two share a name. */
const concepts = [
  concept({ id: 'a', name: 'Alpha', type: 'Project', description: 'First project', content: 'alpha body', tags: ['research'], relatedIds: ['b'] }),
  concept({ id: 'b', name: 'Beta', content: 'plain beta', tags: ['shared'] }),
  concept({ id: 'c', name: 'Alpha', content: 'unrelated gamma content' }),
]

const index = new LibraryIndex(concepts)

describe('LibraryIndex', () => {
  it('cannot outrank an identical concept when its body repeats the claim records', () => {
    const body = 'Caching keeps rendering fast. Graph layout stays stable.'
    // Same name and body, so the only difference is how many claim records the
    // concept carries — all of them restate sentences the body already has.
    const duplicated = concept({
      id: 'claim-in-body',
      name: 'Same name',
      content: body,
      claims: [
        { statement: 'Caching keeps rendering fast.', verification: 'unverified' },
        { statement: 'Graph layout stays stable.', verification: 'unverified' },
        { statement: 'Caching keeps rendering fast.', verification: 'unverified' },
      ],
    })
    const plain = concept({ id: 'no-claim-record', name: 'Same name', content: body })
    const hits = new LibraryIndex([duplicated, plain]).search('rendering', 2)
    expect(hits).toHaveLength(2)
    expect(hits[0]?.concept.id).toBe('claim-in-body')
    expect(hits[0]?.score).toBe(hits[1]?.score)
  })

  it('still indexes a claim the concept body does not contain', () => {
    const withClaim = concept({
      id: 'claim-only',
      name: 'Notes',
      content: 'Nothing here mentions it.',
      claims: [{ statement: 'Flange torque is 12 Nm.', verification: 'unverified' }],
    })
    expect(new LibraryIndex([withClaim]).search('flange').map((hit) => hit.concept.id)).toEqual(['claim-only'])
  })

  it('resolves ids, unique names, ambiguity, and absence', () => {
    const resolveId = (name: string): string | undefined => {
      const result = index.resolve(name)
      return 'concept' in result ? result.concept.id : undefined
    }
    expect(resolveId('a')).toBe('a')
    expect(resolveId('Beta')).toBe('b')
    const ambiguous = index.resolve('Alpha')
    expect('error' in ambiguous && ambiguous.error).toContain('2 concepts')
    const missing = index.resolve('ghost')
    expect('error' in missing && missing.error).toContain('No concept found')
  })

  it('ranks both name-sharing concepts deterministically (shared BM25 engine)', () => {
    const hits = index.search('alpha', 10)
    expect(hits.map((h) => h.concept.id).sort()).toEqual(['a', 'c'])
    expect(hits[0]?.score).toBeGreaterThanOrEqual(hits[1]?.score ?? 0)
    expect(hits.every((h) => h.score > 0)).toBe(true)
  })

  it('searches plain body tokens', () => {
    const hits = index.search('beta', 10)
    expect(hits.map((h) => h.concept.id)).toEqual(['b'])
  })

  it('searches claim statements embedded in concept text', () => {
    const withClaims = new LibraryIndex([
      concept({ id: 'd', name: 'Delta', claims: [{ statement: 'delta claim', verification: 'unverified' }] }),
      concept({ id: 'e', name: 'Echo' }),
    ])
    const hits = withClaims.search('delta claim', 100)
    expect(hits[0]?.concept.id).toBe('d')
    expect(withClaims.search('echo', 0)).toHaveLength(0)
    expect(withClaims.search('echo', 1)).toHaveLength(1)
  })

  it('is stop-word aware (shared engine)', () => {
    // "the" is a stop word: it matches nothing.
    expect(index.search('the', 10)).toHaveLength(0)
  })

  it('censuses tags by count then name', () => {
    const tags = index.tags()
    expect(tags[0]).toEqual({ tag: 'shared', count: 1 })
    expect(tags.length).toBe(2)
  })

  it('finds the shortest related path and reports disconnected pairs', () => {
    const path = index.shortestPath('a', 'b')
    expect(path).toEqual({ found: true, ids: ['a', 'b'] })
    const none = index.shortestPath('a', 'c')
    expect(none).toEqual({ found: false, reason: 'no-path' })
    const self = index.shortestPath('a', 'a')
    expect(self).toEqual({ found: true, ids: ['a'] })
  })

  it('terminates on a related-link cycle', () => {
    const cyclic = new LibraryIndex([
      concept({ id: 'x', name: 'X', relatedIds: ['y'] }),
      concept({ id: 'y', name: 'Y', relatedIds: ['x'] }),
    ])
    expect(cyclic.shortestPath('x', 'y').found).toBe(true)
  })

  it('builds one-hop neighborhoods and drops dangling targets', () => {
    const nb = index.neighborhood('a')
    expect(nb.outgoing.map((c) => c.id)).toEqual(['b'])
    expect(nb.incoming).toEqual([])
    const dangling = new LibraryIndex([
      concept({ id: 'p', name: 'P', relatedIds: ['q', 'ghost'] }),
      concept({ id: 'q', name: 'Q', relatedIds: ['p'] }),
    ])
    expect(dangling.neighborhood('p').outgoing.map((c) => c.id)).toEqual(['q'])
  })

  it('computes bounded graph statistics', () => {
    const stats = index.stats()
    expect(stats.concepts).toBe(3)
    expect(stats.edges).toBe(1)
    expect(stats.components).toBe(2)
    expect(stats.largestComponent).toBe(2)
    expect(stats.avgDegree).toBeCloseTo(2 / 3)
  })

  it('resetSearchCache is exposed for the shared engine', () => {
    pwaResetSearchCache()
    expect(index.search('alpha', 10).length).toBe(2)
  })
})
