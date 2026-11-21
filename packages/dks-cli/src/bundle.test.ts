import { describe, expect, it } from 'vitest'
import {
  BUNDLE_ENV_VAR,
  DEFAULT_BUNDLE_PATH,
  bundleClaims,
  bundleEntities,
  conceptById,
  conceptNameById,
  graphEntities,
  loadBundle,
  readRootIndexVersion,
  resolveBundlePath,
} from './bundle.js'
import { nodeFsPort } from './fs-port.js'
import { seedBundle, withTempDir } from './fixtures.test.helpers.js'
import { CliError } from './errors.js'
import { SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID, SEED_ORPHAN_ID } from './fixtures.test.helpers.js'

describe('resolveBundlePath', () => {
  it('prefers the explicit flag', () => {
    const env = new Map([[BUNDLE_ENV_VAR, '/from/env']])
    expect(resolveBundlePath('/from/flag', env)).toBe('/from/flag')
  })

  it('falls back to the DKS_BUNDLE environment variable', () => {
    expect(resolveBundlePath(undefined, new Map([[BUNDLE_ENV_VAR, '/from/env']]))).toBe('/from/env')
  })

  it('defaults to ./knowledge', () => {
    expect(DEFAULT_BUNDLE_PATH).toBe('./knowledge')
    expect(resolveBundlePath(undefined, new Map())).toBe('./knowledge')
  })

  it('treats a blank DKS_BUNDLE as unset', () => {
    expect(resolveBundlePath(undefined, new Map([[BUNDLE_ENV_VAR, '']]))).toBe(DEFAULT_BUNDLE_PATH)
  })

  it('validates whatever source won', () => {
    expect(() => resolveBundlePath('bad\\path', new Map())).toThrowError(CliError)
    expect(() => resolveBundlePath(undefined, new Map([[BUNDLE_ENV_VAR, 'bad\0path']]))).toThrowError(CliError)
  })
})

describe('loadBundle', () => {
  it('loads a well-formed bundle directory', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir)
      const bundle = loadBundle(nodeFsPort, bundlePath)
      expect(bundle.concepts.length).toBe(3)
      expect(bundle.warnings).toEqual([])
    })
  })

  it('wraps malformed bundles as io failures with the path named', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir, { skipIndex: true })
      try {
        loadBundle(nodeFsPort, bundlePath)
        expect.unreachable('expected loadBundle to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('io')
        expect((err as CliError).message).toContain(bundlePath)
      }
    })
  })
})

describe('bundle adapters', () => {
  it('bundleEntities exposes search-shaped documents', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      const entities = bundleEntities(bundle)
      expect(entities.map((entity) => entity.id)).toEqual([SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID, SEED_ORPHAN_ID])
      const graphPerf = entities.find((entity) => entity.id === SEED_GRAPH_PERF_ID)
      expect(graphPerf?.type).toBe('Concept')
      expect(graphPerf?.tags).toEqual(['graph', 'perf'])
    })
  })

  it('bundleClaims synthesizes stable ids `<entityId>#claim-<n>`', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      const claims = bundleClaims(bundle)
      const claimIds = claims.map((claim) => claim.id)
      expect(claimIds).toContain(`${SEED_GRAPH_PERF_ID}#claim-1`)
      expect(claimIds).toContain(`${SEED_GRAPH_PERF_ID}#claim-2`)
      for (const claim of claims) {
        expect(claim.id.startsWith(`${claim.entityId}#claim-`)).toBe(true)
      }
      const sourced = claims.find((claim) => claim.id === `${SEED_GRAPH_PERF_ID}#claim-1`)
      expect(sourced?.source).toBe('bench/baseline.json')
      expect(sourced?.evidence).toBe('Performance baseline')
    })
  })

  it('graphEntities exposes related links with the canonical relation', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      const entities = graphEntities(bundle)
      const graphPerf = entities.find((entity) => entity.id === SEED_GRAPH_PERF_ID)
      expect(graphPerf?.links).toEqual([{ targetId: SEED_BACKUPS_ID, relation: 'related' }])
    })
  })

  it('conceptNameById resolves ids to display names', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      expect(conceptNameById(bundle).get(SEED_BACKUPS_ID)).toBe('Backups')
      expect(conceptNameById(bundle).get('notes/missing')).toBeUndefined()
    })
  })

  it('conceptById throws entity_not_found with an index hint', async () => {
    await withTempDir(async (dir) => {
      const bundle = loadBundle(nodeFsPort, await seedBundle(dir))
      try {
        conceptById(bundle, 'notes/missing')
        expect.unreachable('expected conceptById to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        const cliError = err as CliError
        expect(cliError.code).toBe('entity_not_found')
        expect(cliError.hint).toContain('dks index')
      }
    })
  })
})

describe('readRootIndexVersion', () => {
  it('reads the declared okf_version of a directory bundle', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir)
      expect(readRootIndexVersion(nodeFsPort, bundlePath)).toBe('0.2')
    })
  })

  it('returns null when the index is missing', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir, { skipIndex: true })
      expect(readRootIndexVersion(nodeFsPort, bundlePath)).toBeNull()
    })
  })
})
