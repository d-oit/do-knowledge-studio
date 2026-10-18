import { describe, expect, it } from 'vitest'
import { makeClaim, makeEntity } from '../studio/test-helpers'
import { resetSearchCache, search } from './retrieval'
import type { Entity, Claim } from '@/lib/studio/types'

const COLD_BUILD_MS_CEILING = 5_000
const CACHED_QUERY_MS_CEILING = 100
const MIN_CACHE_SPEEDUP_FACTOR = 2

describe('BM25 retrieval benchmark', () => {
  it('keeps cached queries faster than cold index rebuilds', () => {
    const datasetSize = 1000
    const claimsPerEntity = 3
    const cachedIterations = 30

    const makeLargeDataset = () => {
      const largeEntities: Entity[] = Array.from({ length: datasetSize }, (_, i) =>
        makeEntity({
          id: `e-${i}`,
          name: `Entity Name ${i}`,
          description: `This is the description for entity number ${i} which discusses React, Hooks, TypeScript and CSS layouts.`,
          content: `# Content ${i}\nHere is some body content with key terms like keyword-${i % 10}.`,
          tags: [`tag-${i % 5}`, 'react', 'typescript'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
      )
      const largeClaims: Claim[] = Array.from({ length: datasetSize * claimsPerEntity }, (_, i) =>
        makeClaim({
          id: `c-${i}`,
          entityId: `e-${i % datasetSize}`,
          statement: `Statement about entity number ${i % datasetSize} regarding React hooks or CSS systems.`,
          confidence: 0.9,
        })
      )
      return { largeEntities, largeClaims }
    }

    const warm = makeLargeDataset()
    search(warm.largeEntities, warm.largeClaims, 'React hooks warmup')

    resetSearchCache()
    const { largeEntities, largeClaims } = makeLargeDataset()
    const coldStart = performance.now()
    search(largeEntities, largeClaims, 'React hooks keyword-3')
    const coldBuildTime = performance.now() - coldStart

    const times: number[] = []
    for (let iteration = 0; iteration < cachedIterations; iteration += 1) {
      const start = performance.now()
      search(largeEntities, largeClaims, `React hooks keyword-${iteration % 10}`)
      times.push(performance.now() - start)
    }

    const avgCached = times.reduce((sum, time) => sum + time, 0) / cachedIterations

    expect(coldBuildTime).toBeLessThan(COLD_BUILD_MS_CEILING)
    expect(avgCached * MIN_CACHE_SPEEDUP_FACTOR).toBeLessThan(coldBuildTime)
    expect(avgCached).toBeLessThan(CACHED_QUERY_MS_CEILING)
  })
})
