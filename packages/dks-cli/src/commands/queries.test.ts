import { describe, expect, it } from 'vitest'
import { loadBundle } from '../bundle.js'
import { nodeFsPort } from '../fs-port.js'
import { SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID, SEED_ORPHAN_ID, seedBundle, withTempDir } from '../fixtures.js'
import { aliasesData, claimsData, entityData, indexData, relationsData, searchData } from './queries.js'
import { CliError } from '../errors.js'

const load = async (dir: string, options?: { skipIndex?: boolean; version?: string }) =>
  loadBundle(nodeFsPort, await seedBundle(dir, options))

describe('searchData', () => {
  it('finds entities and claims for a query', async () => {
    await withTempDir(async (dir) => {
      const data = searchData(await load(dir), '60fps', 20)
      expect(data.results.length).toBeGreaterThan(0)
      expect(data.results.some((hit) => hit.type === 'entity' && hit.id === SEED_GRAPH_PERF_ID)).toBe(true)
      expect(data.results.some((hit) => hit.type === 'claim' && hit.entityId === SEED_GRAPH_PERF_ID)).toBe(true)
    })
  })

  it('carries the query and applied limit', async () => {
    await withTempDir(async (dir) => {
      const data = searchData(await load(dir), 'backups', 7)
      expect(data.query).toBe('backups')
      expect(data.limit).toBe(7)
    })
  })

  it('caps results at the requested limit', async () => {
    await withTempDir(async (dir) => {
      const data = searchData(await load(dir), 'claim', 1)
      expect(data.results.length).toBeLessThanOrEqual(1)
    })
  })

  it('returns an empty result array (ok envelope) for zero hits', async () => {
    await withTempDir(async (dir) => {
      const data = searchData(await load(dir), 'qqqqzzzz', 20)
      expect(data.results).toEqual([])
    })
  })
})

describe('entityData', () => {
  it('returns the entity with claims and resolved relations', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      const data = entityData(bundle, SEED_GRAPH_PERF_ID)
      expect(data.name).toBe('Graph performance')
      expect(data.trustTier).toBe('human-reviewed')
      expect(data.claims.length).toBe(2)
      expect(data.claims.at(0)?.source).toBe('bench/baseline.json')
      expect(data.related).toEqual([{ id: SEED_BACKUPS_ID, name: 'Backups' }])
      expect(data.aliases).toEqual(['graph-perf'])
    })
  })

  it('marks relation targets missing from the bundle', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      const concept = bundle.concepts.find((entry) => entry.id === SEED_BACKUPS_ID)
      if (concept === undefined) throw new Error('fixture concept missing')
      concept.relatedIds = [...concept.relatedIds, 'notes/vanished']
      const data = entityData(bundle, SEED_BACKUPS_ID)
      expect(data.related.some((entry) => entry.name === null && entry.id === 'notes/vanished')).toBe(true)
    })
  })

  it('throws entity_not_found for unknown ids', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      try {
        entityData(bundle, 'nope')
        expect.unreachable('expected entityData to throw')
      } catch (err) {
        expect((err as CliError).code).toBe('entity_not_found')
      }
    })
  })
})

describe('claimsData / aliasesData', () => {
  it('returns the claims of one entity', async () => {
    await withTempDir(async (dir) => {
      const data = claimsData(await load(dir), SEED_BACKUPS_ID)
      expect(data.id).toBe(SEED_BACKUPS_ID)
      expect(data.claims.map((claim) => claim.statement)).toEqual(['Tampered archives fail with a checksum error'])
      expect(data.claims.at(0)?.verification).toBe('unverified')
    })
  })

  it('returns aliases (empty list when none)', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      expect(aliasesData(bundle, SEED_GRAPH_PERF_ID).aliases).toEqual(['graph-perf'])
      expect(aliasesData(bundle, SEED_ORPHAN_ID).aliases).toEqual([])
    })
  })

  it('entity with verified claims inherits the human tier', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      const claims = claimsData(bundle, SEED_GRAPH_PERF_ID).claims
      expect(claims.every((claim) => claim.verification === 'verified')).toBe(true)
    })
  })
})

describe('relationsData', () => {
  it('resolves related ids to names', async () => {
    await withTempDir(async (dir) => {
      const data = relationsData(await load(dir), SEED_GRAPH_PERF_ID)
      expect(data.related).toEqual([{ id: SEED_BACKUPS_ID, name: 'Backups' }])
    })
  })

  it('throws entity_not_found for unknown ids', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      try {
        relationsData(bundle, 'nope')
        expect.unreachable('expected relationsData to throw')
      } catch (err) {
        expect((err as CliError).code).toBe('entity_not_found')
      }
    })
  })
})

describe('indexData', () => {
  it('lists entity ids and names in bundle order', async () => {
    await withTempDir(async (dir) => {
      const data = indexData(await load(dir), 20)
      expect(data.total).toBe(3)
      expect(data.shown).toBe(3)
      expect(data.items.map((entry) => entry.name)).toEqual(['Backups', 'Graph performance', 'Orphan'])
    })
  })

  it('paginates by limit and reports shown of total', async () => {
    await withTempDir(async (dir) => {
      const data = indexData(await load(dir), 2)
      expect(data.total).toBe(3)
      expect(data.shown).toBe(2)
      expect(data.items).toHaveLength(2)
    })
  })
})
