import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const transformersMock = vi.hoisted(() => ({ pipeline: vi.fn() }))
vi.mock('@huggingface/transformers', () => transformersMock)

import { resetSemanticCache, semanticSearch } from './vector-store'
import { clearSemanticCache } from './semantic-cache'
import { disposeEmbedder } from './embeddings'
import type { Entity } from '@/lib/studio/types'

/**
 * Incremental semantic-index benchmark (Issue #1037).
 *
 * Run with `pnpm run test:bench`. The fake embedder isolates index overhead
 * (fingerprinting, diffing, batching, cache writes) from model inference.
 */
const SIZES = [1_000, 5_000, 10_000] as const

const makeEntity = (index: number): Entity => ({
  id: `bench-${index}`,
  name: `Semantic ${index}`,
  type: 'note',
  description: `Benchmark document ${index}`,
  content: `Distinct token-${index % 500} shared vocabulary`,
  tags: ['benchmark'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const fakeExtractor = (texts: string[]) => ({
  dims: [texts.length, 8],
  tolist: () =>
    texts.map((text: string) => {
      const vector = new Array(8).fill(0.01)
      const match = /token-(\d+)/.exec(text)
      if (match) vector[Number(match[1]) % 8] = 1
      return vector
    }),
})

describe('semantic index benchmark', () => {
  beforeEach(async () => {
    disposeEmbedder()
    await clearSemanticCache()
    resetSemanticCache()
    transformersMock.pipeline.mockImplementation(() => fakeExtractor)
  })

  it('measures cold, warm, and single-edit updates at 1k/5k/10k documents', async () => {
    const rows: string[] = []
    for (const size of SIZES) {
      const entities = Array.from({ length: size }, (_, index) => makeEntity(index))
      const coldStart = performance.now()
      await semanticSearch(entities, [], 'token-7', 10)
      const coldMs = performance.now() - coldStart

      const warmStart = performance.now()
      await semanticSearch(entities, [], 'token-7', 10)
      const warmMs = performance.now() - warmStart

      const edited = entities.map((entity, index) =>
        index === Math.floor(size / 2)
          ? { ...entity, content: `${entity.content} edited token-3` }
          : entity,
      )
      const editStart = performance.now()
      await semanticSearch(edited, [], 'token-7', 10)
      const editMs = performance.now() - editStart

      rows.push(
        `${size}\tcold ${coldMs.toFixed(0)}ms\twarm ${warmMs.toFixed(0)}ms\tsingle edit ${editMs.toFixed(0)}ms`,
      )
      expect(warmMs).toBeLessThan(coldMs + 1_000)
      expect(editMs).toBeLessThan(coldMs + 1_000)
    }
    process.stdout.write(`\nSemantic index benchmark (fake embeddings)\n${rows.join('\n')}\n`)
  }, 180_000)
})
