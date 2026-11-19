import { describe, expect, it } from 'vitest'
import { deriveTrustTier, parseBundleFiles, parseConcept, parseIndexVersion } from './okf-parse.js'

/** Minimal valid index file. */
const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`

/** Concept reviewed by a human, with claims, sources, aliases, and a related link. */
const ALPHA = `---
type: Project
title: Alpha Project
description: First project
tags:
  - research
  - alpha
aliases:
  - AP
sources:
  - id: src-1
    resource: https://example.com/alpha
    title: Alpha paper
    author: human:ada
verified:
  by: human:ada
  at: '2026-01-02T00:00:00.000Z'
unknown_future_key: tolerated
---

Body text about alpha.

# Claims

- Alpha scales linearly[^src-1]
- Alpha is cheap

[^src-1]: Alpha paper

# Related

* [Beta](/concepts/beta)
* [Ghost](/concepts/ghost)
`

/** Machine-confirmed concept with no claims. */
const BETA = `---
type: Concept
title: Beta
verified:
  by: process:import
---

Beta body.
`

describe('deriveTrustTier', () => {
  it('treats missing verification as unverified', () => {
    expect(deriveTrustTier(undefined)).toBe('unverified')
    expect(deriveTrustTier(null)).toBe('unverified')
  })

  it('treats a human verifier as human-reviewed', () => {
    expect(deriveTrustTier({ by: 'human:ada' })).toBe('human-reviewed')
    expect(deriveTrustTier([{ by: 'human:ada' }, { by: 'process:import' }])).toBe('human-reviewed')
  })

  it('treats machine actors as machine-confirmed', () => {
    expect(deriveTrustTier({ by: 'process:import' })).toBe('machine-confirmed')
    expect(deriveTrustTier([{ by: 'producer/1.0' }])).toBe('machine-confirmed')
  })

  it('ignores non-object verdict entries', () => {
    expect(deriveTrustTier(['human:ada'])).toBe('unverified')
  })
})

describe('parseConcept', () => {
  it('parses a full concept with claims, sources, aliases, and related ids', () => {
    const c = parseConcept('concepts/alpha', ALPHA)
    expect(c).not.toBeNull()
    if (!c) return
    expect(c.id).toBe('concepts/alpha')
    expect(c.name).toBe('Alpha Project')
    expect(c.type).toBe('Project')
    expect(c.description).toBe('First project')
    expect(c.tags).toEqual(['research', 'alpha'])
    expect(c.aliases).toEqual(['AP'])
    expect(c.trustTier).toBe('human-reviewed')
    expect(c.sources).toEqual([
      { id: 'src-1', resource: 'https://example.com/alpha', title: 'Alpha paper', author: 'human:ada' },
    ])
    expect(c.claims).toEqual([
      { statement: 'Alpha scales linearly', verification: 'verified', source: 'https://example.com/alpha', evidence: 'Alpha paper' },
      { statement: 'Alpha is cheap', verification: 'verified' },
    ])
    expect(c.relatedIds).toEqual(['concepts/beta', 'concepts/ghost'])
    expect(c.content).toBe('Body text about alpha.')
  })

  it('returns null without frontmatter', () => {
    expect(parseConcept('notes/plain', 'Just body.\n')).toBeNull()
  })

  it('returns null on invalid frontmatter', () => {
    expect(parseConcept('notes/bad', '---\ntitle: [unterminated\n---\nbody\n')).toBeNull()
  })

  it('maps a missing title to the file name', () => {
    const c = parseConcept('concepts/no-title', '---\ntype: Note\n---\nbody\n')
    expect(c?.name).toBe('no-title')
    expect(c?.type).toBe('Note')
  })
})

describe('parseBundleFiles', () => {
  const files = new Map<string, string>([
    ['index.md', INDEX],
    ['log.md', '# Log\n'],
    ['concepts/alpha', ALPHA],
    ['concepts/beta', BETA],
    ['notes/plain', 'no frontmatter\n'],
  ])

  it('parses concepts, ignores reserved files, and warns on skipped files', () => {
    const loaded = parseBundleFiles(files)
    expect(loaded.concepts.map((c) => c.id)).toEqual(['concepts/alpha', 'concepts/beta'])
    expect(loaded.concepts[1]?.trustTier).toBe('machine-confirmed')
    expect(loaded.warnings).toEqual(['notes/plain: no readable frontmatter and was skipped.'])
  })

  it('throws without an index declaring okf_version', () => {
    expect(() => parseBundleFiles(new Map([['concepts/a', BETA]]))).toThrow(/index\.md with okf_version/)
  })

  it('throws on an unsupported okf_version', () => {
    const bad = new Map<string, string>([
      ['index.md', "---\nokf_version: '0.3'\n---\n"],
      ['concepts/a', BETA],
    ])
    expect(() => parseBundleFiles(bad)).toThrow(/Unsupported okf_version/)
  })

  it('throws when the bundle holds no parseable concepts', () => {
    const empty = new Map<string, string>([
      ['index.md', INDEX],
      ['notes/plain', 'no frontmatter\n'],
    ])
    expect(() => parseBundleFiles(empty)).toThrow(/no parseable concepts/)
  })
})

describe('parseIndexVersion', () => {
  it('reads quoted and unquoted versions', () => {
    expect(parseIndexVersion("---\nokf_version: '0.2'\n---\n")).toBe('0.2')
    expect(parseIndexVersion('---\nokf_version: 0.2.1\n---\n')).toBe('0.2.1')
    expect(parseIndexVersion('---\ntitle: x\n---\n')).toBeNull()
  })
})
