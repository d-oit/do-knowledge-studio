import { describe, expect, it } from 'vitest'
import { parseMarkdownImport, parseOkfImportBundle } from './index.js'

const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`
const ALPHA = `---
type: Project
title: Alpha
description: First project
tags:
  - research
sources:
  - id: src-1
    resource: https://example.com/alpha
    title: Alpha paper
verified:
  by: human:ada
---

Alpha body.

# Claims

- Alpha scales linearly[^src-1]

[^src-1]: Alpha paper
`
const BETA = `---\ntype: Concept\ntitle: Beta\n---\n\nBeta body.\n`

describe('parseOkfImportBundle (shared service)', () => {
  it('parses entities/claims with trust and provenance', () => {
    const result = parseOkfImportBundle(new Map([
      ['index.md', INDEX],
      ['log.md', '# Log\n'],
      ['concepts/alpha.md', ALPHA],
      ['concepts/beta.md', BETA],
    ]))
    expect(result.errors).toEqual([])
    expect(result.entities.map((e) => e.id)).toEqual(['concepts/alpha', 'concepts/beta'])
    const alpha = result.entities[0]
    expect(alpha?.type).toBe('project')
    expect(alpha?.name).toBe('Alpha')
    expect(alpha?.tags).toEqual(['research'])
    expect(alpha?.content).toContain('Alpha body.')
    expect(result.claims).toEqual([
      {
        entityId: 'concepts/alpha',
        statement: 'Alpha scales linearly',
        verification: 'verified',
        confidence: 1,
        source: 'https://example.com/alpha',
        evidence: 'Alpha paper',
        createdAt: alpha?.createdAt,
        updatedAt: alpha?.updatedAt,
        version: 1,
      },
    ])
  })

  it('collects non-fatal errors for rooted paths and broken files', () => {
    const result = parseOkfImportBundle(new Map([
      ['C:/evil.md', '---\ntype: Note\n---\n'],
      ['concepts/plain.md', 'no frontmatter\n'],
      ['concepts/ok.md', BETA],
    ]))
    expect(result.errors.some((e) => e.includes('not a bundle-relative path'))).toBe(true)
    expect(result.errors.some((e) => e.includes('missing or unparseable frontmatter'))).toBe(true)
    expect(result.entities.map((e) => e.id)).toEqual(['concepts/ok'])
  })

  it('reports missing/unsupported index versions', () => {
    const missing = parseOkfImportBundle(new Map([
      ['index.md', '# Knowledge Bundle'],
      ['concepts/a.md', BETA],
    ]))
    expect(missing.errors.some((e) => e.includes('missing okf_version'))).toBe(true)
    const unsupported = parseOkfImportBundle(new Map([
      ['index.md', "---\nokf_version: '0.3'\n---\n"],
      ['concepts/a.md', BETA],
    ]))
    expect(unsupported.errors.some((e) => e.includes('unsupported okf_version'))).toBe(true)
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
    '',
    'Also [Beta](/notes/beta.md).',
  ].join('\n')],
  ['notes/beta.md', '---\ntitle: Beta\n---\n\nBeta body.\n'],
  ['notes/plain.md', 'no frontmatter\n'],
])

describe('parseMarkdownImport (shared service)', () => {
  it('parses drafts with frontmatter, tags, and scanned link spans', () => {
    const result = parseMarkdownImport(VAULT)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.drafts.map((d) => d.id)).toEqual(['notes/alpha', 'notes/beta', 'notes/plain'])
    const alpha = result.drafts[0]
    expect(alpha?.name).toBe('Alpha')
    expect(alpha?.type).toBe('concept')
    expect(alpha?.aliases).toEqual(['A'])
    expect(alpha?.tags).toEqual(['research', 'tag'])
    expect(alpha?.wikilinks.map((w) => w.name)).toEqual(['Beta', 'Gamma'])
    expect(alpha?.wikilinks[1]?.display).toBe('G')
    expect(alpha?.relativeLinks.map((r) => r.target)).toEqual(['notes/beta.md'])
  })

  it('warns on unknown keys, unknown types, and bad created dates', () => {
    const files = new Map<string, string>([
      ['a.md', '---\ntitle: A\ncustom: x\ntype: widget\ncreated: not-a-date\n---\n'],
    ])
    const result = parseMarkdownImport(files)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.warnings.some((w) => w.includes('custom'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('unknown type "widget"'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('unparseable created date'))).toBe(true)
    expect(result.drafts[0]?.type).toBe('concept')
  })

  it('fails closed on limits (shared with the CLI path)', () => {
    const big = new Map<string, string>([['a.md', 'x'.repeat(1_048_577)]])
    const result = parseMarkdownImport(big)
    expect(result.success).toBe(false)
  })
})
