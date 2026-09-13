import { describe, it, expect } from 'vitest'
import type { Claim, Entity } from '@/lib/studio/types'
import type { SemanticSearchOutcome } from '@/lib/search/search-worker-client'
import { narrowSemanticCorpus, passesTypeFilter, resolveSemanticEntities } from './library-semantic-search'

const makeEntity = (id: string, type: Entity['type'], name = id): Entity => ({
  id,
  name,
  type,
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const makeClaim = (id: string, entityId: string): Claim => ({
  id,
  entityId,
  statement: `statement ${id}`,
  confidence: 0.5,
  verification: 'unverified',
})

const makeOutcome = (
  results: SemanticSearchOutcome['results'],
): SemanticSearchOutcome => ({ source: 'semantic', results })

const makeResult = (
  id: string,
  entityId?: string,
): SemanticSearchOutcome['results'][number] => ({
  id,
  type: entityId === undefined ? 'entity' : 'claim',
  name: id,
  snippet: '',
  score: 1,
  entityId,
})

describe('passesTypeFilter', () => {
  it('passes every entity for the "all" sentinel', () => {
    expect(passesTypeFilter(makeEntity('e1', 'note'), 'all')).toBe(true)
    expect(passesTypeFilter(makeEntity('e2', 'person'), 'all')).toBe(true)
  })

  it('matches the active type and rejects others', () => {
    expect(passesTypeFilter(makeEntity('e1', 'note'), 'note')).toBe(true)
    expect(passesTypeFilter(makeEntity('e1', 'note'), 'concept')).toBe(false)
  })
})

describe('narrowSemanticCorpus', () => {
  it('returns the caller-provided collections unchanged for "all"', () => {
    const entities = [makeEntity('e1', 'note')]
    const claims = [makeClaim('c1', 'e1')]
    const corpus = narrowSemanticCorpus(entities, claims, 'all')
    expect(corpus.entities).toBe(entities)
    expect(corpus.claims).toBe(claims)
  })

  it('keeps only entities of the requested type', () => {
    const corpus = narrowSemanticCorpus(
      [makeEntity('n1', 'note'), makeEntity('c1', 'concept')],
      [],
      'note',
    )
    expect(corpus.entities.map((e) => e.id)).toEqual(['n1'])
  })

  it('drops claims whose entity is outside the narrowed corpus', () => {
    const corpus = narrowSemanticCorpus(
      [makeEntity('n1', 'note'), makeEntity('c1', 'concept')],
      [makeClaim('claim-n', 'n1'), makeClaim('claim-c', 'c1')],
      'note',
    )
    expect(corpus.claims.map((c) => c.id)).toEqual(['claim-n'])
  })

  it('leaves the corpus empty when the type is not present', () => {
    const corpus = narrowSemanticCorpus([makeEntity('n1', 'note')], [makeClaim('c1', 'n1')], 'project')
    expect(corpus.entities).toEqual([])
    expect(corpus.claims).toEqual([])
  })
})

describe('resolveSemanticEntities', () => {
  const entityById = new Map<string, Entity>([
    ['n1', makeEntity('n1', 'note', 'Note one')],
    ['n2', makeEntity('n2', 'note', 'Note two')],
    ['c1', makeEntity('c1', 'concept', 'Concept one')],
  ])

  it('resolves entity hits in rank order', () => {
    const resolved = resolveSemanticEntities(
      makeOutcome([makeResult('n2'), makeResult('n1')]),
      entityById,
      'all',
    )
    expect(resolved.map((e) => e.id)).toEqual(['n2', 'n1'])
  })

  it('resolves claim hits through their owning entity', () => {
    const resolved = resolveSemanticEntities(
      makeOutcome([makeResult('claim-x', 'c1')]),
      entityById,
      'all',
    )
    expect(resolved.map((e) => e.id)).toEqual(['c1'])
  })

  it('deduplicates repeated hits for the same entity', () => {
    const resolved = resolveSemanticEntities(
      makeOutcome([makeResult('n1'), makeResult('claim-x', 'n1')]),
      entityById,
      'all',
    )
    expect(resolved.map((e) => e.id)).toEqual(['n1'])
  })

  it('applies the type filter to resolved entities', () => {
    const resolved = resolveSemanticEntities(
      makeOutcome([makeResult('c1'), makeResult('n1')]),
      entityById,
      'note',
    )
    expect(resolved.map((e) => e.id)).toEqual(['n1'])
  })

  it('skips hits that resolve to nothing', () => {
    const resolved = resolveSemanticEntities(
      makeOutcome([makeResult('missing'), makeResult('claim-y', 'missing'), makeResult('n1')]),
      entityById,
      'all',
    )
    expect(resolved.map((e) => e.id)).toEqual(['n1'])
  })
})
