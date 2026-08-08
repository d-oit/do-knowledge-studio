import { describe, it, expect } from 'vitest'
import {
  parseImportFile,
  buildJsonExport,
  buildMarkdownExport,
  buildHtmlExport,
} from './export-helpers'
import { todayStamp } from './export-types'
import { buildPdfExport, buildDocxExport } from './export-documents'
import { escapeHtml } from '@/lib/security'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from '@/lib/studio/schema'

const SAMPLE_ENTITIES: Entity[] = [
  {
    id: 'e1',
    name: 'Test Entity',
    type: 'note',
    description: 'A test entity',
    content: 'Body content',
    tags: ['test'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    links: [{ targetId: 'e2', relation: 'relates to' }],
  },
]

const SAMPLE_CLAIMS: Claim[] = [
  {
    id: 'c1',
    entityId: 'e1',
    statement: 'Test claim',
    confidence: 0.85,
    verification: 'verified',
    evidence: 'Some evidence',
    source: 'Test source',
  },
]

const SAMPLE_GRAPH: ValidatedGraph = {
  nodes: [{ id: 'n1', label: 'Node 1', type: 'note', x: 0, y: 0 }],
  edges: [{ id: 'ge1', source: 'n1', target: 'n1', relation: 'self' }],
}

const SAMPLE_MIND_MAP: ValidatedMindMap = {
  nodes: [{ id: 'mn1', label: 'Root', type: 'concept' }],
  edges: [],
}

const SAMPLE_LINKS: ValidatedLink[] = [
  { id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'related', createdAt: '2026-01-01T00:00:00.000Z' },
]

const SAMPLE_TAGS: ValidatedTag[] = [
  { id: 't1', name: 'important', color: '#ff0000' },
]

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('handles string with no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('escapes multiple special characters in one string', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    )
  })
})

describe('buildJsonExport', () => {
  it('produces valid JSON with version and metadata', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBeDefined()
    expect(parsed.entities).toHaveLength(1)
    expect(parsed.claims).toHaveLength(1)
  })

  it('round-trips entity data', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, [])
    const parsed = JSON.parse(json)
    expect(parsed.entities[0].name).toBe('Test Entity')
    expect(parsed.entities[0].type).toBe('note')
  })

  it('includes graph, mindMap, links, and tags when provided', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS, { graph: SAMPLE_GRAPH, mindMap: SAMPLE_MIND_MAP, links: SAMPLE_LINKS, tags: SAMPLE_TAGS })
    const parsed = JSON.parse(json)
    expect(parsed.graph).toEqual(SAMPLE_GRAPH)
    expect(parsed.mindMap).toEqual(SAMPLE_MIND_MAP)
    expect(parsed.links).toEqual(SAMPLE_LINKS)
    expect(parsed.tags).toEqual(SAMPLE_TAGS)
  })

  it('omits graph, mindMap, links, and tags when not provided', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    const parsed = JSON.parse(json)
    expect(parsed.graph).toBeUndefined()
    expect(parsed.mindMap).toBeUndefined()
    expect(parsed.links).toBeUndefined()
    expect(parsed.tags).toBeUndefined()
  })
})

describe('buildMarkdownExport', () => {
  it('includes entity name and type', () => {
    const md = buildMarkdownExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(md).toContain('# Test Entity')
    expect(md).toContain('Note')
  })

  it('includes claims', () => {
    const md = buildMarkdownExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(md).toContain('Test claim')
    expect(md).toContain('85%')
  })

  it('handles empty entities', () => {
    const md = buildMarkdownExport([], [])
    expect(md).toContain('0 entities')
  })
})

describe('buildHtmlExport', () => {
  it('produces valid HTML document', () => {
    const html = buildHtmlExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Test Entity')
  })

  it('escapes HTML in entity content', () => {
    const malicious: Entity[] = [{
      ...SAMPLE_ENTITIES[0],
      name: '<script>alert("xss")</script>',
    }]
    const html = buildHtmlExport(malicious, [])
    expect(html).not.toContain('<script>alert("xss")</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('preserves Markdown angle brackets in entity content', () => {
    const md: Entity[] = [{
      ...SAMPLE_ENTITIES[0],
      content: 'Use <div> wrappers and Array<string> types',
    }]
    const html = buildHtmlExport(md, [])
    expect(html).toContain('Use &lt;div&gt; wrappers and Array&lt;string&gt; types')
    expect(html).not.toContain('<div>')
    expect(html).not.toContain('<string>')
  })

  it('includes CSP header', () => {
    const html = buildHtmlExport(SAMPLE_ENTITIES, [])
    expect(html).toContain('Content-Security-Policy')
  })
})

describe('parseImportFile', () => {
  it('parses valid JSON export', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    const result = parseImportFile(json)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.entities).toHaveLength(1)
      expect(result.claims).toHaveLength(1)
    }
  })

  it('returns error on invalid JSON', () => {
    const result = parseImportFile('not json')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0].message).toContain('not valid JSON')
    }
  })

  it('returns error on missing entities array', () => {
    const result = parseImportFile('{"claims":[]}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.message.includes('entities') || e.path.includes('entities'))).toBe(true)
    }
  })

  it('returns error on empty entities', () => {
    const result = parseImportFile('{"entities":[],"claims":[]}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0].message).toContain('No valid entities')
    }
  })

  it('rejects invalid entities via Zod validation', () => {
    const data = {
      entities: [SAMPLE_ENTITIES[0], { invalid: true }],
      claims: [],
    }
    const result = parseImportFile(JSON.stringify(data))
    expect(result.success).toBe(false)
  })

  it('extracts graph, mindMap, links, and tags from JSON', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS, { graph: SAMPLE_GRAPH, mindMap: SAMPLE_MIND_MAP, links: SAMPLE_LINKS, tags: SAMPLE_TAGS })
    const result = parseImportFile(json)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.graph).toEqual(SAMPLE_GRAPH)
      expect(result.mindMap).toEqual(SAMPLE_MIND_MAP)
      expect(result.links).toEqual(SAMPLE_LINKS)
      expect(result.tags).toEqual(SAMPLE_TAGS)
    }
  })

  it('returns undefined for graph/mindMap/links/tags when absent', () => {
    const json = buildJsonExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    const result = parseImportFile(json)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.graph).toBeUndefined()
      expect(result.mindMap).toBeUndefined()
      expect(result.links).toBeUndefined()
      expect(result.tags).toBeUndefined()
    }
  })
})

describe('todayStamp', () => {
  it('returns YYYY-MM-DD format', () => {
    const stamp = todayStamp()
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('buildPdfExport', () => {
  it('returns a non-empty Blob', () => {
    const blob = buildPdfExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('returns a PDF blob with correct MIME type', () => {
    const blob = buildPdfExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(blob.type).toBe('application/pdf')
  })

  it('handles empty entities', () => {
    const blob = buildPdfExport([], [])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('buildDocxExport', () => {
  it('returns a non-empty Blob', async () => {
    const blob = await buildDocxExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('returns a DOCX blob with correct MIME type', async () => {
    const blob = await buildDocxExport(SAMPLE_ENTITIES, SAMPLE_CLAIMS)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('handles empty entities', async () => {
    const blob = await buildDocxExport([], [])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
