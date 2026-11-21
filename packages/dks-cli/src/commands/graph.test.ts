import { describe, expect, it } from 'vitest'
import { loadBundle } from '../bundle.js'
import { nodeFsPort } from '../fs-port.js'
import { SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID, SEED_ORPHAN_ID, seedBundle, withTempDir } from '../fixtures.js'
import { DEFAULT_NEIGHBOR_DEPTH, MAX_NEIGHBOR_DEPTH, graphData, neighborsData, parseDepth, pathData, statsData } from './graph.js'
import { CliError } from '../errors.js'

const load = async (dir: string) => loadBundle(nodeFsPort, await seedBundle(dir))

describe('parseDepth', () => {
  it('parses integers within the allowed range', () => {
    expect(parseDepth('1')).toBe(1)
    expect(parseDepth(String(MAX_NEIGHBOR_DEPTH))).toBe(MAX_NEIGHBOR_DEPTH)
  })

  it('rejects non-integers and out-of-range depths', () => {
    expect(() => parseDepth('bogus')).toThrowError(CliError)
    expect(() => parseDepth('1.5')).toThrowError(/integer/)
    expect(() => parseDepth('0')).toThrowError(CliError)
    expect(() => parseDepth('4')).toThrowError(/out of range/)
  })

  it('documents the neighbors depth bounds', () => {
    expect(DEFAULT_NEIGHBOR_DEPTH).toBe(1)
    expect(MAX_NEIGHBOR_DEPTH).toBe(3)
  })
})

describe('neighborsData', () => {
  it('collects the depth-1 neighborhood by default', async () => {
    await withTempDir(async (dir) => {
      const data = neighborsData(await load(dir), SEED_GRAPH_PERF_ID, DEFAULT_NEIGHBOR_DEPTH)
      expect(data.root).toBe(SEED_GRAPH_PERF_ID)
      expect(data.nodes.map((node) => node.id).sort()).toEqual([SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID].sort())
      expect(data.nodes.at(1)?.depth).toBe(1)
      expect(data.edges).toEqual([{ source: SEED_BACKUPS_ID, target: SEED_GRAPH_PERF_ID, relation: 'related' }])
    })
  })

  it('reaches the second shell at depth 2, undirected', async () => {
    await withTempDir(async (dir) => {
      const data = neighborsData(await load(dir), SEED_GRAPH_PERF_ID, 2)
      const backupNode = data.nodes.find((node) => node.id === SEED_BACKUPS_ID)
      expect(backupNode?.depth).toBe(1)
      // Backups links back to graph-perf, so depth 2 covers no extra node
      // here; the edge is still reported once (deduplicated).
      expect(data.edges.length).toBe(1)
    })
  })

  it('throws entity_not_found for an unknown root', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      expect(() => neighborsData(bundle, 'nope', 1)).toThrowError(CliError)
      expect(() => neighborsData(bundle, 'nope', 1)).toThrowError(/unknown entity/)
    })
  })

  it('includes the orphan check for isolated nodes', async () => {
    await withTempDir(async (dir) => {
      const data = neighborsData(await load(dir), SEED_ORPHAN_ID, DEFAULT_NEIGHBOR_DEPTH)
      expect(data.nodes).toHaveLength(1)
      expect(data.edges).toHaveLength(0)
    })
  })
})

describe('pathData', () => {
  it('finds the shortest undirected path with resolved names', async () => {
    await withTempDir(async (dir) => {
      const data = pathData(await load(dir), SEED_BACKUPS_ID, SEED_GRAPH_PERF_ID)
      expect(data.from).toBe(SEED_BACKUPS_ID)
      expect(data.to).toBe(SEED_GRAPH_PERF_ID)
      expect(data.nodes.map((node) => node.name)).toEqual(['Backups', 'Graph performance'])
      expect(data.hops).toEqual([{ from: SEED_BACKUPS_ID, to: SEED_GRAPH_PERF_ID, relation: 'related' }])
    })
  })

  it('maps a path of one node when from equals to', async () => {
    await withTempDir(async (dir) => {
      const data = pathData(await load(dir), SEED_ORPHAN_ID, SEED_ORPHAN_ID)
      expect(data.nodes).toHaveLength(1)
      expect(data.hops).toHaveLength(0)
    })
  })

  it('throws entity_not_found when either endpoint is unknown', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      try {
        pathData(bundle, SEED_BACKUPS_ID, 'notes/missing-entity')
        expect.unreachable('expected pathData to throw')
      } catch (err) {
        expect((err as CliError).code).toBe('entity_not_found')
      }
    })
  })
})

describe('statsData', () => {
  it('counts nodes, unique undirected edges, and orphans', async () => {
    await withTempDir(async (dir) => {
      const data = statsData(await load(dir))
      expect(data.nodes).toBe(3)
      expect(data.edges).toBe(1)
      expect(data.orphans).toBe(1)
      expect(data.orphanIds).toEqual([SEED_ORPHAN_ID])
    })
  })

  it('buckets the type histogram deterministically', async () => {
    await withTempDir(async (dir) => {
      const data = statsData(await load(dir))
      expect(data.types).toEqual([
        { type: 'Concept', count: 1 },
        { type: 'Idea', count: 1 },
        { type: 'Note', count: 1 },
      ])
    })
  })
})

describe('graphData dispatch', () => {
  it('dispatches stats without operands', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      const data = graphData(['stats'], () => bundle)
      expect('nodes' in data && 'edges' in data).toBe(true)
    })
  })

  it('requires an id for neighbors and two ids for path', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      expect(() => graphData(['neighbors'], () => bundle)).toThrowError(CliError)
      expect(() => graphData(['path', 'a'], () => bundle)).toThrowError(/start and a goal/)
    })
  })

  it('passes --depth through to neighbors', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      const data = graphData(['neighbors', SEED_GRAPH_PERF_ID, '--depth', '2'], () => bundle)
      expect('depth' in data && data.depth === 2).toBe(true)
    })
  })

  it('rejects unknown graph subcommands with the known list', async () => {
    await withTempDir(async (dir) => {
      const bundle = await load(dir)
      try {
        graphData(['edges'], () => bundle)
        expect.unreachable('expected graphData to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('usage')
        expect((err as CliError).hint).toContain('neighbors')
      }
    })
  })
})
