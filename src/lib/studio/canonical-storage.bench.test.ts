import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { STUDIO_STORAGE_KEY } from './hydration'
import { canonicalStudioStorage, resetCanonicalStorageForTests } from './canonical-storage'
import type { Entity, Claim } from './types'

/**
 * Storage boundary benchmark (Issue #1036).
 *
 * Not part of the default suite. Run with `pnpm run test:bench` and read the
 * logged table; no absolute threshold can be portable across CI CPUs. The
 * assertion only catches a catastrophic regression (e.g. a synchronous
 * localStorage write per 10k-entity edit taking longer than the test timeout).
 */
const SIZES = [1_000, 5_000, 10_000] as const

const makeEntity = (index: number): Entity => ({
  id: `entity-${index}`,
  name: `Benchmark entity ${index}`,
  type: index % 3 === 0 ? 'concept' : 'note',
  description: `Description ${index} with searchable vocabulary`,
  content: `# Entity ${index}\n${'Body paragraph. '.repeat(12)}`,
  tags: [`tag-${index % 10}`, 'benchmark'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const makeClaims = (entityCount: number): Claim[] =>
  Array.from({ length: entityCount * 2 }, (_, index) => ({
    id: `claim-${index}`,
    entityId: `entity-${index % entityCount}`,
    statement: `Claim ${index} about entity ${index % entityCount}`,
    confidence: 0.8,
    verification: 'unverified',
    version: 1,
    editHistory: [],
  }))

const serializeLegacyEnvelope = (entities: Entity[], claims: Claim[]): string =>
  JSON.stringify({
    state: { entities, claims },
    version: CURRENT_SCHEMA_VERSION,
  })

describe('canonical storage benchmark', () => {
  it('measures legacy JSON and IndexedDB structured writes at 1k/5k/10k records', async () => {
    const rows: string[] = []
    for (const size of SIZES) {
      const entities = Array.from({ length: size }, (_, index) => makeEntity(index))
      const claims = makeClaims(size)
      const value = { state: { entities, claims }, version: CURRENT_SCHEMA_VERSION }

      const legacyStart = performance.now()
      const legacyRaw = serializeLegacyEnvelope(entities, claims)
      const legacyWriteMs = performance.now() - legacyStart
      const legacyParseStart = performance.now()
      JSON.parse(legacyRaw)
      const legacyParseMs = performance.now() - legacyParseStart

      await resetCanonicalStorageForTests()
      const indexedStart = performance.now()
      await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, value)
      const indexedWriteMs = performance.now() - indexedStart
      const indexedReadStart = performance.now()
      await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)
      const indexedReadMs = performance.now() - indexedReadStart

      rows.push(
        `${size}\tlegacy ${legacyWriteMs.toFixed(1)}ms\tparse ${legacyParseMs.toFixed(1)}ms\t` +
          `IDB ${indexedWriteMs.toFixed(1)}ms\tread ${indexedReadMs.toFixed(1)}ms`,
      )
      expect(indexedWriteMs).toBeLessThan(30_000)
      expect(legacyRaw.length).toBeGreaterThan(0)
    }
    process.stdout.write(`\nStorage benchmark (structured clone, fake IndexedDB)\n${rows.join('\n')}\n`)
  }, 120_000)
})
