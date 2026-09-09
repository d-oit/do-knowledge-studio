import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the transformers.js package; the real embeddings module runs against
// a deterministic fake pipeline, so no model download happens in tests.
const transformersMock = vi.hoisted(() => ({ pipeline: vi.fn() }))

vi.mock('@huggingface/transformers', () => transformersMock)

import { VectorStore, semanticSearch, resetSemanticCache, cosineSimilarity } from './vector-store'
import { disposeEmbedder } from './embeddings'
import type { Entity, Claim } from '@/lib/studio/types'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'e1',
  name: 'Test Entity',
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const makeClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'c1',
  entityId: 'e1',
  statement: 'A claim statement',
  confidence: 0.8,
  verification: 'unverified',
  ...overrides,
})

/** Keyword-triggered 8-dim vectors: shared keywords give high cosine. */
const makeExtractor = (): ReturnType<typeof vi.fn> =>
  vi.fn(async (texts: string[]) => ({
    dims: [texts.length, 8],
    tolist: () =>
      texts.map((text: string) => {
        const vec = new Array(8).fill(0.01)
        if (/triz/i.test(text)) vec[0] = 1
        if (/segmentation/i.test(text)) vec[1] = 1
        if (/generics/i.test(text)) vec[2] = 1
        return vec
      }),
  }))

const trizEntity = makeEntity({
  id: 'e1',
  name: 'TRIZ Inventive Principles',
  type: 'concept',
  description: 'Systematic innovation method',
  content: 'Forty principles for engineering contradictions',
  tags: ['triz', 'innovation'],
})

const genericsEntity = makeEntity({
  id: 'e2',
  name: 'TypeScript Generics',
  type: 'concept',
  description: 'Reusable typed components',
  content: 'Type parameters for flexible reusable functions',
  tags: ['typescript'],
})

describe('VectorStore (pure index)', () => {
  const store = new VectorStore()
  const docA = { id: 'a', type: 'entity' as const, name: 'Alpha', fullText: 'alpha text' }
  const docB = { id: 'b', type: 'entity' as const, name: 'Beta', fullText: 'beta text' }

  beforeEach(() => {
    store.clear()
  })

  it('starts empty', () => {
    expect(store.size).toBe(0)
    expect(store.search([1, 0])).toEqual([])
    expect(store.search([1, 0], 5, () => true)).toEqual([])
  })

  it('adds documents and reports size', () => {
    store.add(docA, [1, 0])
    store.add(docB, [0, 1])
    expect(store.size).toBe(2)
  })

  it('upserts replace the previous vector for the same id', () => {
    store.add(docA, [1, 0])
    store.upsert(docA, [0, 1])
    const [hit] = store.search([0, 1], 1)
    expect(hit.id).toBe('a')
    expect(store.size).toBe(1)
  })

  it('ranks by cosine similarity and returns topK in order', () => {
    store.add(docA, [1, 0])
    store.add(docB, [0.9, 0.1])
    const hits = store.search([1, 0], 2)
    expect(hits.map((h) => h.id)).toEqual(['a', 'b'])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  it('normalizes unnormalized vectors on write (cosine ≈ 1 for the same direction)', () => {
    store.add(docA, [3, 4])
    const [hit] = store.search([0.6, 0.8], 1)
    expect(hit.id).toBe('a')
    expect(hit.score).toBeCloseTo(1)
  })

  it('applies the filter predicate before ranking', () => {
    store.add(docA, [1, 0])
    store.add(docB, [0.9, 0.1])
    const hits = store.search([1, 0], 5, (doc) => doc.id === 'b')
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('b')
  })

  it('removes documents', () => {
    store.add(docA, [1, 0])
    store.remove('a')
    expect(store.size).toBe(0)
  })

  it('snapshot/restore round-trips docs and vectors', () => {
    store.add(docA, [3, 4])
    const snapshot = store.snapshot()
    store.clear()
    store.restore(snapshot)
    const [hit] = store.search([0.6, 0.8], 1)
    expect(hit.id).toBe('a')
    expect(hit.score).toBeCloseTo(1)
  })

  it('restore drops vectors without a matching document id', () => {
    store.restore({
      docs: [docA],
      vectors: [
        { id: 'a', vector: [1, 0] },
        { id: 'ghost', vector: [0, 1] },
      ],
    })
    expect(store.size).toBe(1)
  })
})

describe('cosineSimilarity', () => {
  it('scores identical normalized vectors at 1 and orthogonal at 0', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0)
    expect(cosineSimilarity([0.6, 0.8], [1, 0])).toBeCloseTo(0.6)
  })
})

describe('semanticSearch (mocked embedder)', () => {
  let extractor: ReturnType<typeof vi.fn>

  beforeEach(() => {
    disposeEmbedder()
    resetSemanticCache()
    extractor = makeExtractor()
    transformersMock.pipeline.mockImplementation(async () => extractor)
  })

  it('ranks documents by semantic cosine similarity', async () => {
    const entities = [trizEntity, genericsEntity]
    const claims: Claim[] = []
    const outcome = await semanticSearch(entities, claims, 'triz contradiction resolution', 5)
    expect(outcome.source).toBe('semantic')
    expect(outcome.results[0].id).toBe('e1')
    expect(outcome.results[0].type).toBe('entity')
    expect(outcome.results[0].name).toBe('TRIZ Inventive Principles')
    expect(outcome.results[0].score).toBeGreaterThan(0)
  })

  it('returns claim results with their entity context', async () => {
    const entities = [trizEntity]
    const claims = [
      makeClaim({
        id: 'c1',
        entityId: 'e1',
        statement: 'Segmentation separates conflicting components (triz principle)',
      }),
    ]
    const outcome = await semanticSearch(entities, claims, 'segmentation', 5)
    expect(outcome.source).toBe('semantic')
    expect(outcome.results.some((r) => r.id === 'c1' && r.entityId === 'e1')).toBe(true)
  })

  it('returns an empty semantic result for an empty query without embedding', async () => {
    const outcome = await semanticSearch([trizEntity], [], '   ', 5)
    expect(outcome).toEqual({ source: 'semantic', results: [] })
  })

  it('reuses the built index across calls with the same corpus reference', async () => {
    const entities = [trizEntity, genericsEntity]
    const claims: Claim[] = []
    await semanticSearch(entities, claims, 'triz', 5)
    const callsAfterBuild = extractor.mock.calls.length
    await semanticSearch(entities, claims, 'triz', 5)
    // Second call re-embeds only the query, not the two documents.
    expect(extractor.mock.calls.length).toBe(callsAfterBuild + 1)
  })

  it('falls back to lexical BM25 with a surfaced reason when the embedder fails', async () => {
    transformersMock.pipeline.mockRejectedValue(new Error('model download blocked'))
    const outcome = await semanticSearch([trizEntity], [], 'triz', 5)
    if (outcome.source !== 'lexical') {
      throw new Error(`expected lexical fallback, got ${outcome.source}`)
    }
    expect(outcome.reason).toContain('model download blocked')
    expect(outcome.results.length).toBeGreaterThan(0)
  })

  it('clears the partial index when a mid-build batch fails', async () => {
    extractor.mockRejectedValueOnce(new Error('inference failed mid-batch'))
    const outcome = await semanticSearch([trizEntity, genericsEntity], [], 'triz', 5)
    if (outcome.source !== 'lexical') {
      throw new Error(`expected lexical fallback, got ${outcome.source}`)
    }
    expect(outcome.reason).toContain('inference failed')
  })
})