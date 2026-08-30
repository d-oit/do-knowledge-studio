import { describe, expect, it } from 'vitest'
import {
  ClaimSchema,
  EntitySchema,
  EntityTypeSchema,
  ExportPayloadSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  GraphSchema,
  MindMapNodeSchema,
  MindMapEdgeSchema,
  MindMapSchema,
  LinkSchema,
  TagSchema,
  PersistedEnvelopeSchema,
  VerificationStatusSchema,
  validateImportPayload,
  validatePersistedState,
} from './schema'

// ── EntityTypeSchema ────────────────────────────────────────────────

describe('EntityTypeSchema', () => {
  it.each(['note', 'concept', 'person', 'project'])('accepts %s', (val) => {
    expect(EntityTypeSchema.parse(val)).toBe(val)
  })

  it.each(['', 'NOTE', 'unknown', null, undefined, 42])('rejects %s', (val) => {
    expect(() => EntityTypeSchema.parse(val)).toThrow()
  })
})

// ── VerificationStatusSchema ────────────────────────────────────────

describe('VerificationStatusSchema', () => {
  it.each(['unverified', 'verified', 'disputed'])('accepts %s', (val) => {
    expect(VerificationStatusSchema.parse(val)).toBe(val)
  })

  it.each(['', 'pending', 'Verified', null, undefined])('rejects %s', (val) => {
    expect(() => VerificationStatusSchema.parse(val)).toThrow()
  })
})

// ── EntitySchema ────────────────────────────────────────────────────

const validEntity = {
  id: 'e1',
  name: 'Test',
  type: 'note' as const,
  description: 'desc',
  content: 'body',
  tags: ['a'],
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  links: [{ targetId: 'e2', relation: 'related' }],
}

describe('EntitySchema', () => {
  it('accepts a valid entity', () => {
    expect(EntitySchema.parse(validEntity)).toEqual(validEntity)
  })

  it('accepts valid sourceUrl', () => {
    expect(EntitySchema.parse({ ...validEntity, sourceUrl: 'https://example.com' }).sourceUrl).toBe(
      'https://example.com',
    )
  })

  it('rejects invalid sourceUrl', () => {
    expect(() =>
      EntitySchema.parse({ ...validEntity, sourceUrl: 'not-a-url' }),
    ).toThrow()
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.com/phishing',
    'https:/\\evil.com',
  ])('rejects unsafe sourceUrl scheme/bypass %s', (unsafeUrl) => {
    expect(() =>
      EntitySchema.parse({ ...validEntity, sourceUrl: unsafeUrl }),
    ).toThrow()
  })

  it.each([
    'javascript:alert(1',
    'data:text/html,<script>alert(1)',
    '//evil.com/<script>',
  ])('rejects malformed unsafe sourceUrl %s', (malformedUrl) => {
    expect(() =>
      EntitySchema.parse({ ...validEntity, sourceUrl: malformedUrl }),
    ).toThrow()
  })

  it('accepts missing sourceUrl', () => {
    const { sourceUrl: _, ...rest } = { ...validEntity, sourceUrl: undefined }
    expect(EntitySchema.parse(rest).sourceUrl).toBeUndefined()
  })

  it('rejects empty string id', () => {
    expect(() => EntitySchema.parse({ ...validEntity, id: '' })).toThrow()
  })

  it('rejects empty string name', () => {
    expect(() => EntitySchema.parse({ ...validEntity, name: '' })).toThrow()
  })

  it('accepts empty tags array', () => {
    expect(EntitySchema.parse({ ...validEntity, tags: [] }).tags).toEqual([])
  })

  it('accepts links with empty-string fields', () => {
    const entity = { ...validEntity, links: [{ targetId: '', relation: '' }] }
    expect(EntitySchema.parse(entity).links[0].targetId).toBe('')
  })

  it('rejects missing required fields', () => {
    expect(() => EntitySchema.parse({ id: 'e1' })).toThrow()
  })

  it('strips extra fields', () => {
    const extra = { ...validEntity, mystery: true }
    const parsed = EntitySchema.parse(extra)
    expect(parsed).not.toHaveProperty('mystery')
  })
})

// ── ClaimSchema ─────────────────────────────────────────────────────

const validClaim = {
  id: 'c1',
  entityId: 'e1',
  statement: 'The sky is blue',
  confidence: 0.8,
  verification: 'verified' as const,
}

describe('ClaimSchema', () => {
  it('accepts a valid claim with defaults', () => {
    const parsed = ClaimSchema.parse(validClaim)
    expect(parsed.version).toBe(1)
    expect(parsed.editHistory).toEqual([])
  })

  it('accepts confidence = 0', () => {
    expect(ClaimSchema.parse({ ...validClaim, confidence: 0 }).confidence).toBe(0)
  })

  it('accepts confidence = 1', () => {
    expect(ClaimSchema.parse({ ...validClaim, confidence: 1 }).confidence).toBe(1)
  })

  it.each([-0.001, 1.001, Number.NaN])('rejects confidence = %s', (val) => {
    expect(() => ClaimSchema.parse({ ...validClaim, confidence: val })).toThrow()
  })

  it.each([0, -1, 1.5])('rejects version = %s', (val) => {
    expect(() => ClaimSchema.parse({ ...validClaim, version: val })).toThrow()
  })

  it('accepts optional evidence and source', () => {
    const parsed = ClaimSchema.parse({ ...validClaim, evidence: 'ev', source: 'src' })
    expect(parsed.evidence).toBe('ev')
    expect(parsed.source).toBe('src')
  })

  it('accepts optional createdAt and updatedAt', () => {
    const parsed = ClaimSchema.parse({
      ...validClaim,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    })
    expect(parsed.createdAt).toBe('2025-01-01')
  })
})

// ── GraphNodeSchema ────────────────────────────────────────────────

describe('GraphNodeSchema', () => {
  it('accepts valid node', () => {
    const node = { id: 'n1', label: 'Node 1', type: 'note' as const, x: 10, y: 20 }
    expect(GraphNodeSchema.parse(node)).toEqual(node)
  })

  it.each(['note', 'concept', 'person', 'project'])('accepts type %s', (type) => {
    expect(GraphNodeSchema.parse({ id: 'n1', label: 'A', type, x: 0, y: 0 })).toBeDefined()
  })

  it('rejects empty id', () => {
    expect(() => GraphNodeSchema.parse({ id: '', label: 'A', type: 'note', x: 0, y: 0 })).toThrow()
  })

  it('rejects invalid type', () => {
    expect(() => GraphNodeSchema.parse({ id: 'n1', label: 'A', type: 'bad', x: 0, y: 0 })).toThrow()
  })

  it('rejects non-number x', () => {
    expect(() => GraphNodeSchema.parse({ id: 'n1', label: 'A', type: 'note', x: '0', y: 0 })).toThrow()
  })

  it('accepts negative coordinates', () => {
    expect(GraphNodeSchema.parse({ id: 'n1', label: 'A', type: 'note', x: -5, y: -10 })).toBeDefined()
  })
})

// ── GraphEdgeSchema ────────────────────────────────────────────────

describe('GraphEdgeSchema', () => {
  it('accepts valid edge', () => {
    const edge = { id: 'e1', source: 'n1', target: 'n2', relation: 'relates to' }
    expect(GraphEdgeSchema.parse(edge)).toEqual(edge)
  })

  it('rejects empty id', () => {
    expect(() => GraphEdgeSchema.parse({ id: '', source: 'n1', target: 'n2', relation: 'r' })).toThrow()
  })

  it('accepts empty source/target/relation', () => {
    const edge = { id: 'e1', source: '', target: '', relation: '' }
    expect(GraphEdgeSchema.parse(edge)).toBeDefined()
  })
})

// ── GraphSchema ────────────────────────────────────────────────────

describe('GraphSchema', () => {
  it('accepts valid graph', () => {
    const graph = {
      nodes: [{ id: 'n1', label: 'A', type: 'note' as const, x: 0, y: 0 }],
      edges: [{ id: 'e1', source: 'n1', target: 'n1', relation: 'self' }],
    }
    expect(GraphSchema.parse(graph)).toEqual(graph)
  })

  it('accepts empty graph', () => {
    expect(GraphSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
  })

  it('rejects invalid node in nodes array', () => {
    const graph = { nodes: [{ id: '', label: 'A', type: 'note', x: 0, y: 0 }], edges: [] }
    expect(() => GraphSchema.parse(graph)).toThrow()
  })

  it('rejects invalid edge in edges array', () => {
    const graph = { nodes: [], edges: [{ id: '', source: '', target: '', relation: '' }] }
    expect(() => GraphSchema.parse(graph)).toThrow()
  })
})

// ── MindMapNodeSchema ──────────────────────────────────────────────

describe('MindMapNodeSchema', () => {
  it('accepts valid node without coordinates', () => {
    const node = { id: 'n1', label: 'Node', type: 'concept' as const }
    expect(MindMapNodeSchema.parse(node)).toEqual(node)
  })

  it('accepts node with optional coordinates', () => {
    const node = { id: 'n1', label: 'Node', type: 'note' as const, x: 10, y: 20 }
    expect(MindMapNodeSchema.parse(node)).toEqual(node)
  })

  it('rejects empty id', () => {
    expect(() => MindMapNodeSchema.parse({ id: '', label: 'A', type: 'note' })).toThrow()
  })

  it('rejects invalid type', () => {
    expect(() => MindMapNodeSchema.parse({ id: 'n1', label: 'A', type: 'bad' })).toThrow()
  })

  it('rejects non-number x when provided', () => {
    expect(() => MindMapNodeSchema.parse({ id: 'n1', label: 'A', type: 'note', x: '10' })).toThrow()
  })
})

// ── MindMapEdgeSchema ──────────────────────────────────────────────

describe('MindMapEdgeSchema', () => {
  it('accepts valid edge', () => {
    const edge = { id: 'e1', source: 'n1', target: 'n2', relation: 'child' }
    expect(MindMapEdgeSchema.parse(edge)).toEqual(edge)
  })

  it('rejects empty id', () => {
    expect(() => MindMapEdgeSchema.parse({ id: '', source: 'n1', target: 'n2', relation: 'r' })).toThrow()
  })
})

// ── MindMapSchema ──────────────────────────────────────────────────

describe('MindMapSchema', () => {
  it('accepts valid mind map', () => {
    const map = {
      nodes: [{ id: 'n1', label: 'Root', type: 'concept' as const }],
      edges: [],
    }
    expect(MindMapSchema.parse(map)).toEqual(map)
  })

  it('accepts empty mind map', () => {
    expect(MindMapSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
  })

  it('rejects invalid node', () => {
    const map = { nodes: [{ id: '', label: 'A', type: 'note' }], edges: [] }
    expect(() => MindMapSchema.parse(map)).toThrow()
  })

  it('rejects invalid edge', () => {
    const map = { nodes: [], edges: [{ id: '', source: '', target: '', relation: '' }] }
    expect(() => MindMapSchema.parse(map)).toThrow()
  })
})

// ── LinkSchema ─────────────────────────────────────────────────────

describe('LinkSchema', () => {
  it('accepts valid link', () => {
    const link = { id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'related', createdAt: '2025-01-01' }
    expect(LinkSchema.parse(link)).toEqual(link)
  })

  it('rejects empty id', () => {
    expect(() => LinkSchema.parse({ id: '', sourceId: 'e1', targetId: 'e2', type: 'r', createdAt: '2025-01-01' })).toThrow()
  })

  it('accepts empty sourceId/targetId/type', () => {
    const link = { id: 'l1', sourceId: '', targetId: '', type: '', createdAt: '' }
    expect(LinkSchema.parse(link)).toBeDefined()
  })
})

// ── TagSchema ──────────────────────────────────────────────────────

describe('TagSchema', () => {
  it('accepts valid tag with color', () => {
    const tag = { id: 't1', name: 'important', color: '#ff0000' }
    expect(TagSchema.parse(tag)).toEqual(tag)
  })

  it('accepts tag without color', () => {
    const tag = { id: 't1', name: 'important' }
    expect(TagSchema.parse(tag)).toEqual(tag)
  })

  it('rejects empty id', () => {
    expect(() => TagSchema.parse({ id: '', name: 'tag' })).toThrow()
  })

  it('accepts empty name', () => {
    expect(TagSchema.parse({ id: 't1', name: '' })).toBeDefined()
  })
})

// ── ExportPayloadSchema ─────────────────────────────────────────────

describe('ExportPayloadSchema', () => {
  const payload = {
    version: 1,
    exportedAt: '2025-01-01',
    entities: [validEntity],
    claims: [validClaim],
  }

  it('accepts valid payload', () => {
    expect(ExportPayloadSchema.parse(payload)).toBeDefined()
  })

  it('accepts version 0', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: 0 }).version).toBe(0)
  })

  it('accepts version -1', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: -1 }).version).toBe(-1)
  })

  it('accepts version 1.5', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: 1.5 }).version).toBe(1.5)
  })

  it('accepts empty arrays', () => {
    expect(ExportPayloadSchema.parse({ ...payload, entities: [], claims: [] })).toBeDefined()
  })

  it('rejects missing fields', () => {
    expect(() => ExportPayloadSchema.parse({ version: 1 })).toThrow()
  })

  it('rejects invalid entity in entities', () => {
    expect(() =>
      ExportPayloadSchema.parse({ ...payload, entities: [{ id: '' }] }),
    ).toThrow()
  })

  it('rejects invalid claim in claims', () => {
    expect(() =>
      ExportPayloadSchema.parse({ ...payload, claims: [{ id: 'c1' }] }),
    ).toThrow()
  })

  it('accepts payload with graph, mindMap, links, and tags', () => {
    const graph = { nodes: [{ id: 'n1', label: 'A', type: 'note' as const, x: 0, y: 0 }], edges: [] }
    const mindMap = { nodes: [{ id: 'm1', label: 'B', type: 'concept' as const }], edges: [] }
    const links = [{ id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'related', createdAt: '2025-01-01' }]
    const tags = [{ id: 't1', name: 'tag1', color: '#ff0000' }]
    const result = ExportPayloadSchema.parse({ ...payload, graph, mindMap, links, tags })
    expect(result.graph).toEqual(graph)
    expect(result.mindMap).toEqual(mindMap)
    expect(result.links).toEqual(links)
    expect(result.tags).toEqual(tags)
  })

  it('accepts payload without graph, mindMap, links, or tags (backward compat)', () => {
    const result = ExportPayloadSchema.parse(payload)
    expect(result.graph).toBeUndefined()
    expect(result.mindMap).toBeUndefined()
    expect(result.links).toBeUndefined()
    expect(result.tags).toBeUndefined()
  })

  it('rejects invalid graph nodes', () => {
    const graph = { nodes: [{ id: '', label: 'A', type: 'note', x: 0, y: 0 }], edges: [] }
    expect(() => ExportPayloadSchema.parse({ ...payload, graph })).toThrow()
  })

  it('rejects invalid mindMap edges', () => {
    const mindMap = { nodes: [], edges: [{ id: '', source: '', target: '', relation: '' }] }
    expect(() => ExportPayloadSchema.parse({ ...payload, mindMap })).toThrow()
  })

  it('rejects invalid links', () => {
    const links = [{ id: '', sourceId: '', targetId: '', type: '', createdAt: '' }]
    expect(() => ExportPayloadSchema.parse({ ...payload, links })).toThrow()
  })

  it('rejects invalid tags', () => {
    const tags = [{ id: '', name: '' }]
    expect(() => ExportPayloadSchema.parse({ ...payload, tags })).toThrow()
  })
})

// ── PersistedEnvelopeSchema ─────────────────────────────────────────

describe('PersistedEnvelopeSchema', () => {
  const envelope = {
    version: 1,
    entities: [validEntity],
    claims: [validClaim],
    chat: [],
    currentView: 'home',
    typeFilter: 'all',
    sortBy: 'updated',
    sortDir: 'desc',
    rightPanelOpen: true,
  }

  it('accepts version 1', () => {
    expect(PersistedEnvelopeSchema.parse(envelope).version).toBe(1)
  })

  it.each([0, -1, 1.5])('rejects version = %s', (val) => {
    expect(() => PersistedEnvelopeSchema.parse({ ...envelope, version: val })).toThrow()
  })

  it('accepts empty arrays', () => {
    expect(
      PersistedEnvelopeSchema.parse({ ...envelope, entities: [], claims: [] }),
    ).toBeDefined()
  })

  it('treats version as optional middleware metadata', () => {
    // zustand stores the envelope version OUTSIDE the state object, so
    // normal same-version hydrations arrive without it.
    const { version: _omitted, ...withoutVersion } = envelope
    void _omitted
    expect(PersistedEnvelopeSchema.parse(withoutVersion).entities).toEqual([validEntity])
  })
})

// ── validatePersistedState ──────────────────────────────────────────

describe('validatePersistedState', () => {
  it('returns success for valid data', () => {
    const result = validatePersistedState({
      version: 1,
      entities: [validEntity],
      claims: [validClaim],
      chat: [],
      currentView: 'home',
      typeFilter: 'all',
      sortBy: 'updated',
      sortDir: 'desc',
      rightPanelOpen: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe(1)
    }
  })

  it.each([null, undefined, 42, [1, 2], 'hello'])('returns errors for %s', (val) => {
    const result = validatePersistedState(val)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('collects multiple errors', () => {
    const result = validatePersistedState({ version: 'nope', entities: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(1)
    }
  })

  it('includes nested paths in errors', () => {
    const result = validatePersistedState({
      version: 1,
      entities: [{ id: '', name: '', type: 'invalid' }],
      claims: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.errors.map((e) => e.path)
      expect(paths.some((p) => p.startsWith('entities.'))).toBe(true)
    }
  })
})

// ── validateImportPayload ───────────────────────────────────────────

describe('validateImportPayload', () => {
  const payload = {
    version: 1,
    exportedAt: '2025-01-01',
    entities: [validEntity],
    claims: [validClaim],
  }

  it('returns success for valid payload', () => {
    const result = validateImportPayload(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.exportedAt).toBe('2025-01-01')
    }
  })

  it.each([null, undefined, 42, 'hello'])('returns errors for %s', (val) => {
    const result = validateImportPayload(val)
    expect(result.success).toBe(false)
  })

  it('returns errors for invalid entity', () => {
    const result = validateImportPayload({
      ...payload,
      entities: [{ id: '', name: '', type: 'bad' }],
    })
    expect(result.success).toBe(false)
  })

  it('returns errors for invalid claim', () => {
    const result = validateImportPayload({
      ...payload,
      claims: [{ id: '', entityId: '', statement: '', confidence: 5, verification: 'nope' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts version 0', () => {
    const result = validateImportPayload({ ...payload, version: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts version -1', () => {
    const result = validateImportPayload({ ...payload, version: -1 })
    expect(result.success).toBe(true)
  })

  it('accepts version 1.5', () => {
    const result = validateImportPayload({ ...payload, version: 1.5 })
    expect(result.success).toBe(true)
  })
})
