import { describe, it, expect, vi } from 'vitest'
import { handleWorkerMessage, type SearchWorkerRequest } from './search-worker'
import { SearchWorkerClient, searchAsync } from './search-worker-client'
import type { Entity, Claim } from '@/lib/studio/types'

const testEntities: Entity[] = [
  {
    id: 'e1',
    name: 'TRIZ Inventive Principles',
    type: 'concept',
    description: 'Systematic innovation principles',
    content: 'Forty inventive principles for engineering contradictions',
    tags: ['triz', 'innovation'],
    created: '2026-09-01T00:00:00.000Z',
    updated: '2026-09-01T00:00:00.000Z',
    links: [],
  },
]

const testClaims: Claim[] = [
  {
    id: 'c1',
    entityId: 'e1',
    statement: 'Principle 1 Segmentation separates conflicting components.',
    confidence: 'confirmed',
    created: '2026-09-01T00:00:00.000Z',
  },
]

describe('Search Worker Handler', () => {
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
})
