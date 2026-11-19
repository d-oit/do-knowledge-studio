import { describe, expect, it } from 'vitest'
import { checkVaultLimits, parseMarkdownBundle, slug, stripMarkdownExtension } from './markdown.js'

describe('slug', () => {
  it('kebab-cases names', () => {
    expect(slug('Hello World')).toBe('hello-world')
    expect(slug('  Spaced  ')).toBe('spaced')
    expect(slug('!!!')).toBe('untitled')
  })
})

describe('stripMarkdownExtension', () => {
  it('strips .md and .markdown', () => {
    expect(stripMarkdownExtension('notes/a.md')).toBe('notes/a')
    expect(stripMarkdownExtension('notes/a.markdown')).toBe('notes/a')
    expect(stripMarkdownExtension('notes/a.txt')).toBe('notes/a.txt')
  })
})

describe('checkVaultLimits', () => {
  it('fails closed on empty, oversized, and over-count batches', () => {
    expect(checkVaultLimits(new Map())).toMatch(/No Markdown files/)
    const many = new Map<string, string>()
    for (let i = 0; i < 501; i += 1) many.set(`f${i}.md`, 'x')
    expect(checkVaultLimits(many)).toMatch(/Too many files/)
    const huge = new Map<string, string>([['a.md', 'x'.repeat(1_048_577)]])
    expect(checkVaultLimits(huge)).toMatch(/too large/)
  })
})

const VAULT = new Map<string, string>([
  ['notes/alpha.md', [
    '---',
    'title: Alpha',
    'type: concept',
    'tags:',
    '  - research',
    'aliases:',
    '  - A',
    'description: First concept',
    '---',
    '',
    'Alpha body with #tag #research.',
    '',
    'See [[Beta]] and [[Gamma|G]].',
  ].join('\n')],
  ['notes/beta.md', [
    '---',
    'title: Beta',
    '---',
    '',
    'Beta body.',
  ].join('\n')],
  ['notes/plain.md', 'no frontmatter\n'],
])

describe('parseMarkdownBundle', () => {
  it('accepts full-YAML frontmatter (block scalars and anchors)', () => {
    // Parity pin: frontmatter here parses with the `yaml` package (as the
    // pre-shared-core importer did). The zero-dependency subset parser
    // rejects block scalars/multi-line values, so this test would fail if
    // the import path regressed to it.
    const files = new Map([
      ['notes/deep.md', '---\ntitle: Deep\ndescription: |\n  line one\n  line two\ntags: [deep]\nsummary: &s shared\n---\nBody text.\n'],
    ])
    const r = parseMarkdownBundle(files)
    expect(r.success).toBe(true)
    if (!r.success) return
    const deep = r.entities.find((e) => e.id === 'notes/deep')
    expect(deep?.name).toBe('Deep')
    expect(deep?.description).toBe('line one\nline two\n')
  })

  it('parses entities with aliases, tags, and wikilink resolution', () => {
    const r = parseMarkdownBundle(VAULT)
    expect(r.success).toBe(true)
    if (!r.success) return
    const alpha = r.entities.find((e) => e.id === 'notes/alpha')
    expect(alpha?.name).toBe('Alpha')
    expect(alpha?.type).toBe('concept')
    expect(alpha?.aliases).toEqual(['A'])
    expect(alpha?.tags).toEqual(['research', 'tag'])
    expect(alpha?.links).toEqual([{ targetId: 'notes/beta', relation: 'related' }, { targetId: 'gamma', relation: 'related' }])
    expect(r.stubNames).toEqual(['Gamma'])
    expect(r.conflicts).toEqual([])
    const stub = r.entities.find((e) => e.id === 'gamma')
    expect(stub?.name).toBe('Gamma')
    expect(stub?.description).toMatch(/Stub/)
    const plain = r.entities.find((e) => e.id === 'notes/plain')
    expect(plain?.name).toBe('plain')
    expect(plain?.content).toBe('no frontmatter')
  })

  it('reports name conflicts', () => {
    const files = new Map<string, string>([
      ['a.md', '---\ntitle: Same\n---\n'],
      ['b.md', '---\ntitle: Same\n---\n'],
    ])
    const r = parseMarkdownBundle(files)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.conflicts.length).toBe(1)
  })

  it('collects unknown frontmatter key warnings', () => {
    const files = new Map<string, string>([['a.md', '---\ntitle: A\ncustom: x\n---\n']])
    const r = parseMarkdownBundle(files)
    if (!r.success) return
    expect(r.warnings.some((w) => w.includes('custom'))).toBe(true)
  })

  it('fails closed on limit violations', () => {
    const files = new Map<string, string>([['a.md', 'x'.repeat(1_048_577)]])
    const r = parseMarkdownBundle(files)
    expect(r.success).toBe(false)
  })
})
