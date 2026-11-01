import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Entity } from '@/lib/studio/types'

/**
 * Retrieval-mode switch in the AI context builder (Issue #1065).
 *
 * Mocked here rather than exercised through the real embedder: the hybrid path
 * loads a model, and the assertion is about *which* retriever the builder
 * chooses and whether it formats that retriever's results — not about ranking
 * quality, which the search harnesses score.
 */

vi.mock('@/lib/search/search-worker-client', () => ({
  searchAsync: vi.fn(),
  searchSemantic: vi.fn(),
}))

import { buildSystemPromptAsync } from './context'
import { searchAsync, searchSemantic } from '@/lib/search/search-worker-client'

const mockedSearchAsync = vi.mocked(searchAsync)
const mockedSearchSemantic = vi.mocked(searchSemantic)

const entity = (id: string, name: string): Entity => ({
  id,
  name,
  type: 'concept',
  description: '',
  content: '',
  tags: ['triz'],
  links: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const ENTITIES = [entity('e1', 'Lexical Hit'), entity('e2', 'Hybrid Hit')]

describe('buildSystemPromptAsync retrieval mode', () => {
  beforeEach(() => {
    mockedSearchAsync.mockReset()
    mockedSearchSemantic.mockReset()
    mockedSearchAsync.mockResolvedValue([
      { id: 'e1', type: 'entity', name: 'Lexical Hit', snippet: 'from bm25', score: 1 },
    ])
    mockedSearchSemantic.mockResolvedValue({
      source: 'hybrid',
      results: [
        {
          id: 'e2',
          type: 'entity',
          name: 'Hybrid Hit',
          snippet: 'from fusion',
          score: 1,
          signals: ['lexical', 'semantic'],
        },
      ],
    })
  })

  it('uses the lexical worker path by default', async () => {
    const prompt = await buildSystemPromptAsync('query', ENTITIES, [], true)

    expect(mockedSearchAsync).toHaveBeenCalledTimes(1)
    expect(mockedSearchSemantic).not.toHaveBeenCalled()
    expect(prompt).toContain('Lexical Hit')
  })

  it('uses fused retrieval when the mode is hybrid', async () => {
    const prompt = await buildSystemPromptAsync('query', ENTITIES, [], true, undefined, {
      retrieval: 'hybrid',
    })

    expect(mockedSearchSemantic).toHaveBeenCalledTimes(1)
    expect(mockedSearchAsync).not.toHaveBeenCalled()
    expect(prompt).toContain('Hybrid Hit')
    expect(prompt).toContain('[triz]')
  })

  it('does not touch either retriever when augmentation is off', async () => {
    const prompt = await buildSystemPromptAsync('query', ENTITIES, [], false, undefined, {
      retrieval: 'hybrid',
    })

    expect(mockedSearchSemantic).not.toHaveBeenCalled()
    expect(mockedSearchAsync).not.toHaveBeenCalled()
    expect(prompt).not.toContain('Relevant entities')
  })
})
