/**
 * Cross-adapter parity (#1170 acceptance row 6): the `dks` CLI and the MCP
 * adapter load one on-disk bundle through the same `dks-core` services. This
 * harness drives both adapter modules directly to prove the two runtimes agree
 * for the same input rather than trusting that they call the same functions.
 *
 * Scope: for a claim-free bundle both adapters build the identical document
 * set, so search scores and ordering must match exactly. With claims the
 * adaptations differ on purpose — the CLI emits claim rows, while MCP folds
 * claim text into the concept document and returns concept hits (readable via
 * `get_claims`) — so that case stays with each adapter's own suite.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryIndex } from 'dks-core'
import { afterEach, describe, expect, it } from 'vitest'
import { loadBundle as loadBundleViaCli } from '../packages/dks-cli/src/bundle.js'
import { neighborsData, pathData } from '../packages/dks-cli/src/commands/graph.js'
import { searchData } from '../packages/dks-cli/src/commands/queries.js'
import { nodeFsPort } from '../packages/dks-cli/src/fs-port.js'
import { loadBundle as loadBundleViaMcp } from '../packages/dks-mcp/src/bundle-reader.js'
import { callTool } from '../packages/dks-mcp/src/tool-definitions.js'

/** Temporary bundle directories created during the suite. */
const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

/** Reserved index doc declaring the bundle format version. */
const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`

/** Writes a claim-free bundle whose concepts exercise ranking and tag ties. */
const writeFixtureBundle = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dks-parity-'))
  tempDirs.push(dir)
  mkdirSync(join(dir, 'concepts'), { recursive: true })
  writeFileSync(join(dir, 'index.md'), INDEX)
  writeFileSync(
    join(dir, 'concepts', 'alpha.md'),
    `---\ntype: Project\ntitle: Alpha\ndescription: graph store\ntags: [shared, alpha]\n---\n\nNodes and edges connect.\n\n# Related\n\n* [Beta](/concepts/beta)\n`,
  )
  writeFileSync(
    join(dir, 'concepts', 'beta.md'),
    `---\ntype: Concept\ntitle: Beta\ntags: [shared, beta]\n---\n\nA graph query planner.\n\n# Related\n\n* [Gamma](/concepts/gamma)\n`,
  )
  writeFileSync(
    join(dir, 'concepts', 'gamma.md'),
    `---\ntype: Concept\ntitle: Gamma\ntags: [gamma]\n---\n\nUnrelated prose.\n`,
  )
  writeFileSync(
    join(dir, 'concepts', 'delta.md'),
    `---\ntype: Concept\ntitle: Delta\ntags: [delta]\n---\n\nGraph graph graph, densely repeated.\n`,
  )
  return dir
}

/** Parses the single JSON text payload of an MCP tool result. */
const payloadOf = (result: unknown): unknown => {
  const content = (result as { content: Array<{ text?: string }> }).content
  return JSON.parse(content[0]?.text ?? '{}')
}

describe('dks CLI ↔ dks-mcp parity', () => {
  it('loads the same bundle into identical concepts', async () => {
    const dir = writeFixtureBundle()
    const viaCli = await loadBundleViaCli(nodeFsPort, dir)
    const viaMcp = await loadBundleViaMcp(dir)

    expect(viaMcp.concepts).toEqual(viaCli.concepts)
    expect(viaMcp.warnings).toEqual(viaCli.warnings)
    expect(viaMcp.concepts).toHaveLength(4)
  })

  it('ranks entity hits identically for the same query and limit', async () => {
    const dir = writeFixtureBundle()
    const viaCli = await loadBundleViaCli(nodeFsPort, dir)
    const viaMcp = await loadBundleViaMcp(dir)
    const query = 'graph'

    const cliIds = searchData(viaCli, query, 10)
      .results.filter((result) => result.type === 'entity')
      .map((result) => result.id)
    const mcpHits = new LibraryIndex(viaMcp.concepts).search(query, 10)
    const mcpPayload = payloadOf(callTool('search', { query }, new LibraryIndex(viaMcp.concepts)))
    const mcpIds = (mcpPayload as { hits: Array<{ id: string }> }).hits.map((hit) => hit.id)

    // More than one hit, so this asserts an order rather than a singleton.
    expect(cliIds.length).toBeGreaterThan(1)
    expect(mcpIds).toEqual(cliIds)
    expect(mcpHits.map((hit) => hit.concept.id)).toEqual(cliIds)
  })

  it('agrees on shortest paths and one-hop neighborhoods', async () => {
    const dir = writeFixtureBundle()
    const viaCli = await loadBundleViaCli(nodeFsPort, dir)
    const index = new LibraryIndex((await loadBundleViaMcp(dir)).concepts)

    const cliPath = pathData(viaCli, 'concepts/alpha', 'concepts/gamma')
    const mcpPath = payloadOf(
      callTool('find_path', { from: 'concepts/alpha', to: 'concepts/gamma' }, index),
    ) as { found: boolean; hops: number; path: Array<{ id: string }> }

    expect(cliPath.nodes.map((node) => node.id)).toEqual([
      'concepts/alpha',
      'concepts/beta',
      'concepts/gamma',
    ])
    expect(mcpPath.path.map((node) => node.id)).toEqual(cliPath.nodes.map((node) => node.id))
    expect(mcpPath.hops).toBe(cliPath.hops.length)

    const cliHood = neighborsData(viaCli, 'concepts/beta', 1)
    const mcpHood = payloadOf(callTool('neighborhood', { ref: 'concepts/beta' }, index)) as {
      outgoing: Array<{ id: string }>
      incoming: Array<{ id: string }>
    }
    const mcpNeighbors = [...mcpHood.outgoing, ...mcpHood.incoming].map((c) => c.id).sort()
    const cliNeighbors = cliHood.nodes
      .filter((node) => node.id !== 'concepts/beta')
      .map((node) => node.id)
      .sort()

    expect(mcpNeighbors).toEqual(['concepts/alpha', 'concepts/gamma'])
    expect(mcpNeighbors).toEqual(cliNeighbors)
    expect(cliHood.edges.map((edge) => `${edge.source}|${edge.target}`).sort()).toEqual([
      'concepts/alpha|concepts/beta',
      'concepts/beta|concepts/gamma',
    ])
  })

  it('reports the shared tag census, including the descending name tie-break', async () => {
    const dir = writeFixtureBundle()
    const viaMcp = await loadBundleViaMcp(dir)
    const payload = payloadOf(callTool('list_tags', {}, new LibraryIndex(viaMcp.concepts)))

    // `shared` leads on count; the four single-use tags tie and sort by name
    // descending (core's rule), not ascending.
    expect(payload).toEqual({
      tags: [
        { tag: 'shared', count: 2 },
        { tag: 'gamma', count: 1 },
        { tag: 'delta', count: 1 },
        { tag: 'beta', count: 1 },
        { tag: 'alpha', count: 1 },
      ],
    })
  })
})
