/**
 * MCP protocol contract test: a real SDK Client drives the server over
 * InMemoryTransport — tools/list shape, every tool call, and error shapes.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { LibraryIndex, type BundleConcept } from 'dks-core'
import { describe, expect, it, vi } from 'vitest'
import { createServer } from './server.js'

/** Single human-reviewed concept with a sourced claim and a neighbor. */
const concepts: BundleConcept[] = [
  {
    id: 'alpha', name: 'Alpha', type: 'Project', description: 'First',
    content: 'Alpha body.', tags: ['research'], trustTier: 'human-reviewed',
    sources: [{ id: 's1', resource: 'https://example.com', title: 'Paper', author: 'human:ada' }],
    claims: [
      { statement: 'Alpha works', verification: 'verified', source: 'https://example.com', evidence: 'Paper' },
      { statement: 'Alpha is cheap', verification: 'verified' },
    ],
    relatedIds: ['beta'],
  },
  {
    id: 'beta', name: 'Beta', type: 'Concept', description: '', content: 'Beta body.',
    tags: [], trustTier: 'unverified', sources: [], claims: [], relatedIds: [],
  },
]

/** Connects a client to a fresh server over an in-memory transport pair. */
const connect = async (): Promise<Client> => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'contract-test', version: '0.0.0' })
  await Promise.all([
    client.connect(clientTransport),
    createServer(new LibraryIndex(concepts)).connect(serverTransport),
  ])
  return client
}

/** Parses the single JSON text payload of a tool result. */
const payloadOf = (result: unknown): Record<string, unknown> => {
  const content = (result as { content: Array<{ text: string }> }).content
  return JSON.parse(content[0]?.text ?? '{}') as Record<string, unknown>
}

describe('MCP contract', () => {
  it('lists the six read-only tools', async () => {
    const client = await connect()
    try {
      const { tools } = await client.listTools()
      expect(tools.map((t) => t.name).sort()).toEqual(
        ['find_path', 'get_claims', 'get_entity', 'list_tags', 'neighborhood', 'search'],
      )
    } finally {
      await client.close()
    }
  })

  it('serves search, entity, claims, neighborhood, and tags', async () => {
    const client = await connect()
    try {
      const search = payloadOf(await client.callTool({ name: 'search', arguments: { query: 'Alpha' } }))
      expect((search.hits as unknown[])).toHaveLength(1)

      const entity = payloadOf(await client.callTool({ name: 'get_entity', arguments: { ref: 'alpha' } }))
      expect(entity).toMatchObject({ id: 'alpha', trustTier: 'human-reviewed' })

      const claims = payloadOf(await client.callTool({ name: 'get_claims', arguments: { ref: 'Alpha' } }))
      expect(claims).toMatchObject({
        trustTier: 'human-reviewed',
        claims: [
          { statement: 'Alpha works', verification: 'verified', source: 'https://example.com' },
          { statement: 'Alpha is cheap', verification: 'verified' },
        ],
      })

      const hood = payloadOf(await client.callTool({ name: 'neighborhood', arguments: { ref: 'alpha' } }))
      expect(hood).toMatchObject({
        outgoing: [{ id: 'beta' }],
        incoming: [],
      })

      const tags = payloadOf(await client.callTool({ name: 'list_tags', arguments: {} }))
      expect(tags).toEqual({ tags: [{ tag: 'research', count: 1 }] })

      const path = payloadOf(
        await client.callTool({ name: 'find_path', arguments: { from: 'alpha', to: 'beta' } }),
      )
      expect(path).toMatchObject({
        found: true,
        hops: 1,
        path: [{ id: 'alpha' }, { id: 'beta' }],
      })
    } finally {
      await client.close()
    }
  })

  it('serves the opt-in bridge tools over the protocol without mutating the bundle', async () => {
    vi.stubEnv('DKS_MCP_BRIDGE', 'propose')
    // `toolDefinitions` is built at module load, so the flag must be visible
    // before the server module is imported (the real CLI starts that way).
    vi.resetModules()
    const fresh = await import('./server.js')
    const index = new LibraryIndex(concepts)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'contract-test', version: '0.0.0' })
    await Promise.all([
      client.connect(clientTransport),
      fresh.createServer(index).connect(serverTransport),
    ])
    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['propose_claim', 'propose_entity', 'propose_link']),
      )

      const proposal = payloadOf(
        await client.callTool({
          name: 'propose_link',
          arguments: { from: 'alpha', to: 'beta', relation: 'extends' },
        }),
      )
      expect(proposal).toMatchObject({
        kind: 'link',
        requiresReview: true,
        proposal: { sourceId: 'alpha', targetId: 'beta', relation: 'extends' },
      })

      // Proposals are append-only: the served library is unchanged.
      const entity = payloadOf(await client.callTool({ name: 'get_entity', arguments: { ref: 'alpha' } }))
      expect(entity).toMatchObject({ relatedIds: ['beta'] })
      expect(index.size).toBe(2)
    } finally {
      await client.close()
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('returns error results for unknown tools, bad args, and missing refs', async () => {
    const client = await connect()
    try {
      const unknown = await client.callTool({ name: 'nope', arguments: {} })
      expect(unknown.isError).toBe(true)

      const badArgs = await client.callTool({ name: 'search', arguments: { query: '' } })
      expect(badArgs.isError).toBe(true)

      const missing = await client.callTool({ name: 'get_entity', arguments: { ref: 'ghost' } })
      expect(missing.isError).toBe(true)
    } finally {
      await client.close()
    }
  })
})
