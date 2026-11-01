import { describe, expect, it } from 'vitest'
import { RRF_DAMPING, reciprocalRankFusion } from './fusion'
import type { SearchResult } from './retrieval'

const result = (id: string, overrides: Partial<SearchResult> = {}): SearchResult => ({
  id,
  type: 'entity',
  name: id,
  snippet: `${id} snippet`,
  score: 0,
  ...overrides,
})

const semantic = (...ids: string[]): { signal: 'semantic' | 'lexical'; results: SearchResult[] } => ({
  signal: 'semantic',
  results: ids.map((id) => result(id)),
})

const lexical = (...ids: string[]): { signal: 'semantic' | 'lexical'; results: SearchResult[] } => ({
  signal: 'lexical',
  results: ids.map((id) => result(id)),
})

describe('reciprocalRankFusion', () => {
  it('ranks a document present in both lists above single-list documents', () => {
    const fused = reciprocalRankFusion(
      [semantic('both', 'semantic-only'), lexical('both', 'lexical-only')],
      3,
    )

    expect(fused.map((entry) => entry.id)).toEqual(['both', 'lexical-only', 'semantic-only'])
  })

  it('keeps a document only one engine found', () => {
    const fused = reciprocalRankFusion([semantic('semantic-only'), lexical('lexical-only')], 5)

    expect(fused.map((entry) => entry.id).sort()).toEqual(['lexical-only', 'semantic-only'])
  })

  it('deduplicates by id and keeps the highest-ranked payload', () => {
    const fused = reciprocalRankFusion(
      [
        {
          signal: 'semantic',
          results: [result('shared', { name: 'Semantic name', snippet: 'semantic', score: 0.9 })],
        },
        {
          signal: 'lexical',
          results: [result('shared', { name: 'Lexical name', snippet: 'lexical', score: 12 })],
        },
      ],
      5,
    )

    expect(fused).toHaveLength(1)
    expect(fused[0].name).toBe('Semantic name')
    expect(fused[0].snippet).toBe('semantic')
  })

  it('reports the fused score rather than either engine score', () => {
    const fused = reciprocalRankFusion(
      [
        { signal: 'semantic', results: [result('shared', { score: 0.9 })] },
        { signal: 'lexical', results: [result('shared', { score: 12 })] },
      ],
      1,
    )

    expect(fused[0].score).toBeCloseTo(2 / (RRF_DAMPING + 1))
  })

  it('records which retrievers ranked each hit', () => {
    const fused = reciprocalRankFusion(
      [semantic('both', 'semantic-only'), lexical('both', 'lexical-only')],
      3,
    )

    const byId = new Map(fused.map((entry) => [entry.id, entry.signals]))
    expect(byId.get('both')).toEqual(['semantic', 'lexical'])
    expect(byId.get('semantic-only')).toEqual(['semantic'])
    expect(byId.get('lexical-only')).toEqual(['lexical'])
  })

  it('does not duplicate a signal when a list repeats an id', () => {
    const fused = reciprocalRankFusion([semantic('dup', 'dup')], 5)

    expect(fused).toHaveLength(1)
    expect(fused[0].signals).toEqual(['semantic'])
  })

  it('breaks score ties by id so ordering is deterministic', () => {
    const fused = reciprocalRankFusion([semantic('b'), lexical('a')], 5)

    expect(fused.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('respects the limit', () => {
    const fused = reciprocalRankFusion([semantic('a', 'b', 'c')], 2)

    expect(fused.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('returns nothing for an empty set or a non-positive limit', () => {
    expect(reciprocalRankFusion([], 5)).toEqual([])
    expect(reciprocalRankFusion([semantic('a')], 0)).toEqual([])
  })
})
