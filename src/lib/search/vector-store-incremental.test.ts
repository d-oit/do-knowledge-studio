import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const transformersMock = vi.hoisted(() => ({ pipeline: vi.fn() }))
vi.mock('@huggingface/transformers', () => transformersMock)

import {
  getSemanticIndexProgress,
  resetSemanticCache,
  semanticSearch,
  setSemanticIndexBudgetForTests,
  subscribeSemanticIndexProgress,
} from './vector-store'
import { clearSemanticCache } from './semantic-cache'
import { disposeEmbedder } from './embeddings'
import type { Entity } from '@/lib/studio/types'

const makeEntity = (overrides: Partial<Entity>): Entity => ({
  id: 'e1',
  name: 'Entity',
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

/** 8-dim keyword vectors: one axis per distinctive keyword. */
const makeExtractor = (): ReturnType<typeof vi.fn> =>
  vi.fn((texts: string[]) => ({
    dims: [texts.length, 8],
    tolist: () =>
      texts.map((text: string) => {
        const vec = new Array(8).fill(0.01)
        if (/alpha/i.test(text)) vec[0] = 1
        if (/beta/i.test(text)) vec[1] = 1
        if (/updated/i.test(text)) vec[2] = 1
        return vec
      }),
  }))

const alpha = makeEntity({ id: 'alpha', name: 'Alpha topic', description: 'alpha' })
const beta = makeEntity({ id: 'beta', name: 'Beta topic', description: 'beta' })
let extractor: ReturnType<typeof vi.fn>

beforeEach(async () => {
  disposeEmbedder()
  await clearSemanticCache()
  resetSemanticCache()
  setSemanticIndexBudgetForTests(64 * 1024 * 1024)
  extractor = makeExtractor()
  transformersMock.pipeline.mockImplementation(() => extractor)
})

afterEach(() => {
  setSemanticIndexBudgetForTests(64 * 1024 * 1024)
  disposeEmbedder()
})

const embeddedTexts = (): string[] =>
  extractor.mock.calls.flatMap(([texts]) => texts as string[])

describe('incremental semantic indexing', () => {
  it('embeds only the changed document on an edit', async () => {
    await semanticSearch([alpha, beta], [], 'alpha', 5)
    extractor.mockClear()

    const updated = { ...beta, description: 'beta updated content' }
    const outcome = await semanticSearch([alpha, updated], [], 'alpha', 5)

    expect(outcome.source).toBe('semantic')
    const texts = embeddedTexts()
    expect(texts.some((text) => text.includes('updated content'))).toBe(true)
    expect(texts.some((text) => text.includes('Alpha topic'))).toBe(false)
  })

  it('removes deleted documents so they cannot be returned', async () => {
    await semanticSearch([alpha, beta], [], 'beta', 5)
    const outcome = await semanticSearch([alpha], [], 'beta', 5)

    expect(outcome.source).toBe('semantic')
    expect(outcome.results.some((result) => result.id === 'beta')).toBe(false)
    expect(outcome.results.every((result) => result.id !== 'beta')).toBe(true)
  })

  it('keeps a valid index across an aborted build and rebuilds later', async () => {
    await semanticSearch([alpha, beta], [], 'alpha', 5)

    const controller = new AbortController()
    controller.abort()
    await expect(
      semanticSearch([alpha, { ...beta, description: 'beta updated' }], [], 'alpha', 5, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })

    const recovered = await semanticSearch([alpha, { ...beta, description: 'beta updated' }], [], 'alpha', 5)
    expect(recovered.source).toBe('semantic')
    expect(getSemanticIndexProgress().status).toBe('ready')
  })

  it('falls back to lexical when the corpus exceeds the memory budget', async () => {
    setSemanticIndexBudgetForTests(1)
    const outcome = await semanticSearch([alpha, beta], [], 'alpha', 5)

    expect(outcome.source).toBe('lexical')
    if (outcome.source === 'lexical') {
      expect(outcome.reason).toContain('memory budget')
    }
    expect(getSemanticIndexProgress().status).toBe('error')
  })

  it('publishes monotonic progress ending in ready', async () => {
    const snapshots: { status: string; completed: number; total: number }[] = []
    const unsubscribe = subscribeSemanticIndexProgress(() => {
      const progress = getSemanticIndexProgress()
      snapshots.push({ status: progress.status, completed: progress.completed, total: progress.total })
    })
    try {
      await semanticSearch([alpha, beta], [], 'alpha', 5)
    } finally {
      unsubscribe()
    }
    const indexing = snapshots.filter((snapshot) => snapshot.status === 'indexing')
    expect(indexing.length).toBeGreaterThan(0)
    for (const snapshot of indexing) {
      expect(snapshot.completed).toBeLessThanOrEqual(snapshot.total)
    }
    expect(snapshots.at(-1)?.status).toBe('ready')
  })
})
