/**
 * Bridge contract (#1139): propose_* tools are opt-in, validated, and never
 * write to the bundle. Proposals are append-only payloads for studio review.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BundleConcept } from './bundle-reader.js'
import { LibraryIndex } from './library-index.js'
import { bridgeToolDefinitions, callTool, isBridgeEnabled } from './tool-definitions.js'

const concepts: BundleConcept[] = [
  {
    id: 'alpha', name: 'Alpha', type: 'Project', description: '', content: '',
    tags: [], trustTier: 'human-reviewed', sources: [], claims: [], relatedIds: ['beta'],
  },
  {
    id: 'beta', name: 'Beta', type: 'Concept', description: '', content: '',
    tags: [], trustTier: 'unverified', sources: [], claims: [], relatedIds: [],
  },
]

const index = new LibraryIndex(concepts)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('bridge gate', () => {
  it('is disabled by default', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', '')
    expect(isBridgeEnabled()).toBe(false)
    expect(bridgeToolDefinitions()).toEqual([])
  })

  it('refuses propose_* calls when disabled', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', '')
    const result = callTool('propose_claim', { entityRef: 'alpha', statement: 'X' }, index)
    expect(result.isError).toBe(true)
  })

  it('advertises three tools when enabled', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', 'propose')
    expect(isBridgeEnabled()).toBe(true)
    expect(bridgeToolDefinitions().map((t) => t.name).sort()).toEqual([
      'propose_claim',
      'propose_entity',
      'propose_link',
    ])
  })
})

describe('proposals', () => {
  it('builds a claim proposal anchored to a concept', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', 'propose')
    const result = callTool('propose_claim', { entityRef: 'Alpha', statement: 'Alpha scales' }, index)
    expect(result.isError).not.toBe(true)
    const text = (result.content as Array<{ text: string }>)[0]?.text ?? '{}'
    const payload = JSON.parse(text) as { kind: string; requiresReview: boolean; proposal: { entityId: string } }
    expect(payload.kind).toBe('claim')
    expect(payload.requiresReview).toBe(true)
    expect(payload.proposal.entityId).toBe('alpha')
  })

  it('builds entity and link proposals without touching the bundle', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', 'propose')
    const sizeBefore = index.size
    const entity = callTool('propose_entity', { name: 'Gamma' }, index)
    expect(entity.isError).not.toBe(true)
    const link = callTool('propose_link', { from: 'alpha', to: 'beta', relation: 'extends' }, index)
    expect(link.isError).not.toBe(true)
    expect(index.size).toBe(sizeBefore)
  })

  it('validates args before proposing', () => {
    vi.stubEnv('DKS_MCP_BRIDGE', 'propose')
    expect(callTool('propose_claim', { entityRef: '', statement: '' }, index).isError).toBe(true)
    expect(callTool('propose_link', { from: 'alpha', to: 'ghost', relation: 'x' }, index).isError).toBe(true)
  })
})
