import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleWorkerMessage, type SearchWorkerRequest } from './search-worker'
import {
  SearchWorkerClient,
  searchAsync,
  searchSemantic,
  SEARCH_WORKER_TIMEOUT_MS,
} from './search-worker-client'
import { resetSemanticCache } from './vector-store'
import type { Entity, Claim } from '@/lib/studio/types'
import { EmbedderError } from './embeddings'

// Mock the embeddings module so worker/client semantic tests never touch a
// real model. Deterministic char-bucket vectors keep cosine ranking stable.
const embeddingsMock = vi.hoisted(() => ({ embedTexts: vi.fn() }))

vi.mock('./embeddings', () => ({
  EMBEDDING_MODEL_ID: 'mock-model',
  EMBEDDING_DTYPE: 'q8',
  EMBEDDING_DEVICE: 'wasm',
  EMBED_MAX_CHARS: 512,
  EMBED_BATCH_SIZE: 32,
  EMBED_POOLING: 'mean',
  EmbedderError: class EmbedderError extends Error {},
  embedTexts: embeddingsMock.embedTexts,
  getEmbedder: vi.fn(() => ({})),
  getEmbedderStatus: () => 'ready',
  isEmbedderReady: () => true,
  disposeEmbedder: vi.fn(),
  normalizeEmbedding: (vector: number[]) => {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
    return vector.map((v) => v / norm)
  },
  serializeEmbedding: (vector: number[]) => vector.slice(),
  truncateForEmbedding: (text: string) => text,
}))

/** Shared bucket vector: similar text → high cosine (no real model needed). */
const bucketVector = (text: string): number[] => {
  const vec = new Array(8).fill(0)
  for (const ch of text.toLowerCase()) vec[ch.charCodeAt(0) % 8] += 1
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

const testEntities: Entity[] = [
  {
    id: 'e1',
    name: 'TRIZ Inventive Principles',
    type: 'concept',
    description: 'Systematic innovation principles',
    content: 'Forty inventive principles for engineering contradictions',
    tags: ['triz', 'innovation'],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    links: [],
  },
]

const testClaims: Claim[] = [
  {
    id: 'c1',
    entityId: 'e1',
    statement: 'Principle 1 Segmentation separates conflicting components.',
    confidence: 0.9,
    verification: 'verified',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
]

describe('Search Worker Handler', () => {
  beforeEach(() => {
    embeddingsMock.embedTexts.mockImplementation((texts: string[]) =>
      texts.map(bucketVector),
    )
    resetSemanticCache()
  })

  it('handles SEARCH request and returns matching results', () => {
    const postReply = vi.fn()
    const req: SearchWorkerRequest = {
      id: 'req-1',
      type: 'SEARCH',
      entities: testEntities,
      claims: testClaims,
      query: 'segmentation',
      limit: 5,
    }

    handleWorkerMessage(req, postReply)

    expect(postReply).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'req-1',
        type: 'SUCCESS',
        results: expect.arrayContaining([
          expect.objectContaining({ id: 'c1', type: 'claim' }),
        ]),
      }),
    )
  })

  it('handles RESET request cleanly', () => {
    const postReply = vi.fn()
    const req: SearchWorkerRequest = {
      id: 'req-2',
      type: 'RESET',
    }

    handleWorkerMessage(req, postReply)

    expect(postReply).toHaveBeenCalledWith({
      id: 'req-2',
      type: 'RESET_SUCCESS',
    })
  })
})

describe('SearchWorkerClient', () => {
  beforeEach(() => {
    embeddingsMock.embedTexts.mockImplementation((texts: string[]) =>
      texts.map(bucketVector),
    )
    resetSemanticCache()
  })

  it('falls back to synchronous search when no Worker is active', async () => {
    const client = new SearchWorkerClient()
    const results = await client.searchAsync(testEntities, testClaims, 'triz', 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toContain('TRIZ')
  })

  it('works via standalone searchAsync helper', async () => {
    const results = await searchAsync(testEntities, testClaims, 'segmentation', 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('c1')
  })

  it('handles mock Worker communication successfully', async () => {
    let messageHandler: ((e: MessageEvent) => void) | null = null
    const mockWorker = {
      postMessage: vi.fn((req) => {
        setTimeout(() => {
          if (messageHandler) {
            messageHandler({
              data: {
                id: req.id,
                type: 'SUCCESS',
                results: [{ id: 'mock-1', name: 'Mock Result', type: 'entity', score: 1, snippet: '' }],
              },
            } as MessageEvent)
          }
        }, 0)
      }),
      set onmessage(fn: (e: MessageEvent) => void) {
        messageHandler = fn
      },
      terminate: vi.fn(),
    } as unknown as Worker

    const client = new SearchWorkerClient(mockWorker)
    const results = await client.searchAsync(testEntities, testClaims, 'mock', 5)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Mock Result')

    client.terminate()
    expect(mockWorker.terminate).toHaveBeenCalled()
  })

  it('rejects when given an already-aborted signal (no worker path)', async () => {
    const client = new SearchWorkerClient()
    const controller = new AbortController()
    controller.abort()
    await expect(
      client.searchAsync(testEntities, testClaims, 'triz', 5, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('aborts an in-flight mock Worker request when the signal fires', async () => {
    let resolvePost!: (req: { id: string }) => void
    const postPromise = new Promise<{ id: string }>((resolve) => {
      resolvePost = resolve
    })
    const mockWorker = {
      postMessage: vi.fn((req: { id: string }) => {
        resolvePost(req)
      }),
      terminate: vi.fn(),
    } as unknown as Worker

    const client = new SearchWorkerClient(mockWorker)
    const controller = new AbortController()
    const pending = client.searchAsync(testEntities, testClaims, 'mock', 5, controller.signal)
    await postPromise
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    // Wait a tick to ensure the abort settled cleanly; postMessage should not
    // be requeued after the request was already removed.
    await Promise.resolve()
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    client.terminate()
  })

  it('rejects with a TimeoutError when the worker never responds', async () => {
    vi.useFakeTimers()
    try {
      const mockWorker = { postMessage: vi.fn(), terminate: vi.fn() } as unknown as Worker
      const client = new SearchWorkerClient(mockWorker)
      const pending = client.searchAsync(testEntities, testClaims, 'mock', 5)
      const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
      await vi.advanceTimersByTimeAsync(SEARCH_WORKER_TIMEOUT_MS)
      await assertion
      client.terminate()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves normally when the signal is never aborted (mock worker)', async () => {
    let messageHandler: ((e: MessageEvent) => void) | null = null
    const mockWorker = {
      postMessage: vi.fn((req) => {
        setTimeout(() => {
          if (messageHandler) {
            messageHandler({
              data: {
                id: req.id,
                type: 'SUCCESS',
                results: [{ id: 'mock-2', name: 'Mock Result', type: 'entity', score: 1, snippet: '' }],
              },
            } as MessageEvent)
          }
        }, 0)
      }),
      set onmessage(fn: (e: MessageEvent) => void) {
        messageHandler = fn
      },
      terminate: vi.fn(),
    } as unknown as Worker

    const client = new SearchWorkerClient(mockWorker)
    const results = await client.searchAsync(testEntities, testClaims, 'mock', 5, new AbortController().signal)
    expect(results).toHaveLength(1)
    client.terminate()
  })

  it('searchSemantic runs the in-process semantic path without a Worker', async () => {

    const outcome = await SearchWorkerClient.searchSemantic(testEntities, testClaims, 'triz', 5)
    expect(outcome.source).toBe('semantic')
    expect(outcome.results.length).toBeGreaterThan(0)
    expect(outcome.results[0].id).toBe('e1')
    expect(embeddingsMock.embedTexts).toHaveBeenCalled()
  })

  it('works via standalone searchSemantic helper', async () => {
    const outcome = await searchSemantic(testEntities, testClaims, 'triz', 5)
    expect(outcome.source).toBe('semantic')
    expect(outcome.results.length).toBeGreaterThan(0)
  })

  it('searchSemantic rejects an already-aborted signal (no worker path)', async () => {

    const controller = new AbortController()
    controller.abort()
    await expect(
      SearchWorkerClient.searchSemantic(testEntities, testClaims, 'triz', 5, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('searchSemantic runs in-process even when a Worker is present', async () => {
    // Regression guard (N1): semantic search must never depend on the search
    // worker — its dynamic transformers.js import cannot resolve under
    // Turbopack's module-worker bundling, which left requests pending forever.
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
    } as unknown as Worker

    const client = new SearchWorkerClient(mockWorker)
    const outcome = await SearchWorkerClient.searchSemantic(testEntities, testClaims, 'triz', 5)
    expect(outcome.source).toBe('semantic')
    expect(outcome.results.length).toBeGreaterThan(0)
    // No worker round-trip happens for semantic search.
    expect(mockWorker.postMessage).not.toHaveBeenCalled()
    client.terminate()
  })

  it('searchSemantic surfaces a lexical fallback outcome when embedding fails', async () => {
    embeddingsMock.embedTexts.mockRejectedValue(new EmbedderError('model offline'))

    const outcome = await SearchWorkerClient.searchSemantic(testEntities, testClaims, 'segmentation', 5)
    expect(outcome.source).toBe('lexical')
    expect(outcome.reason).toContain('model offline')
    expect(outcome.results.length).toBeGreaterThan(0)
  })
})