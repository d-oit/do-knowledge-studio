import { describe, expect, it } from 'vitest'
import type { BundleConcept } from './bundle-reader.js'
import { LibraryIndex } from './library-index.js'

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
  concept({
    id: 'a', name: 'Alpha', description: 'graph store', content: 'nodes and edges',
    tags: ['graph', 'shared'], relatedIds: ['b'],
    claims: [{ statement: 'Alpha persists graphs', verification: 'verified' }],
  }),
  concept({ id: 'b', name: 'Beta', content: 'plain beta', tags: ['shared'] }),
  concept({ id: 'c', name: 'Alpha', content: 'unrelated gamma content' }),
]

describe('LibraryIndex', () => {
  it('resolves ids, unique names, ambiguity, and absence', () => {
    const index = new LibraryIndex(concepts)
    expect(index.size).toBe(3)
    expect(index.resolve('a')).toMatchObject({ concept: { id: 'a' } })
    expect(index.resolve('beta')).toMatchObject({ concept: { id: 'b' } })
    const ambiguous = index.resolve('Alpha')
    expect(ambiguous).toHaveProperty('error', expect.stringContaining('2 concepts'))
    expect(index.resolve('missing')).toHaveProperty('error', expect.stringContaining('No concept'))
  })

  it('ranks name matches above body matches', () => {
    const index = new LibraryIndex(concepts)
    const hits = index.search('beta')
    expect(hits[0]?.concept.id).toBe('b')
  })

  it('normalizes document length in tokens, not characters', () => {
    // Both docs are two content tokens long and hold the term once, so BM25
    // must score them identically. A character-based length would penalize
    // the doc with the longer second token instead.
    const index = new LibraryIndex([
      concept({ id: 'terse', name: 'Terse', content: 'keyword ab' }),
      concept({ id: 'wordy', name: 'Wordy', content: 'keyword abcdefghijklmnop' }),
    ])
    const hits = index.search('keyword')
    expect(hits).toHaveLength(2)
    expect(hits[0]?.score).toBeCloseTo(hits[1]?.score ?? -1, 10)
  })

  it('searches claim statements and clamps limits', () => {
    const index = new LibraryIndex(concepts)
    expect(index.search('persists')).toHaveLength(1)
    expect(index.search('')).toEqual([])
    expect(index.search('alpha', 100)).toHaveLength(2)
  })

  it('censuses tags by count then name', () => {
    const index = new LibraryIndex(concepts)
    expect(index.tags()).toEqual([
      { tag: 'shared', count: 2 },
      { tag: 'graph', count: 1 },
    ])
  })

  it('builds one-hop neighborhoods and drops dangling targets', () => {
    const linked = [
      concept({ id: 'x', name: 'X', relatedIds: ['y', 'ghost'] }),
      concept({ id: 'y', name: 'Y', relatedIds: ['x'] }),
    ]
    const index = new LibraryIndex(linked)
    expect(index.neighborhood('x').outgoing.map((c) => c.id)).toEqual(['y'])
    expect(index.neighborhood('x').incoming.map((c) => c.id)).toEqual(['y'])
    expect(index.neighborhood('y').incoming.map((c) => c.id)).toEqual(['x'])
  })
})
