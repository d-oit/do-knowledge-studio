import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { deriveTrustTier, loadBundle } from './bundle-reader.js'

/** Temporary directories created during the suite. */
const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

/** Creates a temp dir tracked for cleanup. */
const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dks-mcp-'))
  tempDirs.push(dir)
  return dir
}

/** Minimal valid index file. */
const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`
/** Reserved log file. */
const LOG = `# Log\n`

/** Concept reviewed by a human, with claims, sources, and a related link. */
const ALPHA = `---
type: Project
title: Alpha Project
description: First project
tags:
  - research
  - alpha
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
  - by: process:do-knowledge-studio/0.2.0
---

Beta body.
`

describe('deriveTrustTier', () => {
  it('maps missing, empty, human, and machine verifiers', () => {
    expect(deriveTrustTier(undefined)).toBe('unverified')
    expect(deriveTrustTier([])).toBe('unverified')
    expect(deriveTrustTier({ by: 'human:ada' })).toBe('human-reviewed')
    expect(deriveTrustTier([{ by: 'process:x/1' }])).toBe('machine-confirmed')
    expect(deriveTrustTier('human:ada')).toBe('unverified')
  })
})

describe('loadBundle from a directory', () => {
  it('loads concepts, claims, sources, and related ids', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'concepts'), { recursive: true })
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'log.md'), LOG)
    writeFileSync(join(dir, 'concepts', 'alpha.md'), ALPHA)
    writeFileSync(join(dir, 'concepts', 'beta.md'), BETA)

    const { concepts, warnings } = loadBundle(dir)
    expect(warnings).toEqual([])
    expect(concepts).toHaveLength(2)

    const alpha = concepts.find((c) => c.id === 'concepts/alpha')
    expect(alpha?.name).toBe('Alpha Project')
    expect(alpha?.trustTier).toBe('human-reviewed')
    expect(alpha?.tags).toEqual(['research', 'alpha'])
    expect(alpha?.claims).toHaveLength(2)
    expect(alpha?.claims[0]).toMatchObject({
      statement: 'Alpha scales linearly',
      verification: 'verified',
      source: 'https://example.com/alpha',
      evidence: 'Alpha paper',
    })
    expect(alpha?.claims[1]).toMatchObject({ statement: 'Alpha is cheap', verification: 'verified' })
    expect(alpha?.content).not.toContain('# Claims')
    expect(alpha?.relatedIds).toEqual(['concepts/beta', 'concepts/ghost'])

    const beta = concepts.find((c) => c.id === 'concepts/beta')
    expect(beta?.trustTier).toBe('machine-confirmed')
    expect(beta?.claims).toEqual([])
  })

  it('warns on frontmatter-less files and rejects empty bundles', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'broken.md'), 'no frontmatter here\n')

    expect(() => loadBundle(dir)).toThrow(/no parseable concepts/)
  })

  it('rejects bundles without a versioned index', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), '# no version\n')
    writeFileSync(join(dir, 'a.md'), ALPHA)

    expect(() => loadBundle(dir)).toThrow(/index\.md with okf_version/)
  })

  it('rejects unsupported bundle versions', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), `---\nokf_version: '9.9'\n---\n`)
    writeFileSync(join(dir, 'a.md'), ALPHA)

    expect(() => loadBundle(dir)).toThrow(/Unsupported okf_version/)
  })

  it('loads nested directories with bundle-relative ids', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'sub', 'nested.md'), BETA)
    writeFileSync(join(dir, 'ok.md'), ALPHA)

    const { concepts } = loadBundle(dir)
    expect(concepts.map((c) => c.id).sort()).toEqual(['ok', 'sub/nested'])
  })
})

describe('loadBundle from a zip', () => {
  /** Zips entries under the studio `okf-bundle/` prefix. */
  const zipOf = (entries: Record<string, string>): Buffer => {
    const prefixed: Record<string, Uint8Array> = {}
    for (const [name, content] of Object.entries(entries)) {
      prefixed[`okf-bundle/${name}`] = strToU8(content)
    }
    return Buffer.from(zipSync(prefixed))
  }

  it('reads prefixed entries and skips zip-slip names', () => {
    const dir = makeTempDir()
    const zip = zipOf({
      'index.md': INDEX,
      'concepts/alpha.md': ALPHA,
      '../evil.md': ALPHA,
      '/absolute.md': ALPHA,
    })
    const target = join(dir, 'bundle.zip')
    writeFileSync(target, zip)

    const { concepts, warnings } = loadBundle(target)
    expect(concepts.map((c) => c.id)).toEqual(['concepts/alpha'])
    expect(warnings).toEqual([])
  })

  it('rejects oversized zips fail-closed', () => {
    const dir = makeTempDir()
    const target = join(dir, 'bundle.zip')
    writeFileSync(target, Buffer.alloc(10_485_760 + 1))

    expect(() => loadBundle(target)).toThrow(/too large/)
  })
})
