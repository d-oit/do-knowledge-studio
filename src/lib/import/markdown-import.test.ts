import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_MARKDOWN_FILE_BYTES,
  MAX_MARKDOWN_FILES,
  MAX_MARKDOWN_TOTAL_BYTES,
  checkVaultLimits,
  extractHashtags,
  parseVaultFiles,
} from './markdown-import'

/** Recursively reads a fixture directory into a vault-relative path → content map. */
const readFixtureVault = (root: string): Map<string, string> => {
  const files = new Map<string, string>()
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      else files.set(`${prefix}${entry.name}`, readFileSync(join(dir, entry.name), 'utf8'))
    }
  }
  walk(root, '')
  return files
}

/** Unwraps a successful import result or throws with the failure error. */
const expectSuccess = (result: ReturnType<typeof parseVaultFiles>) => {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result
}

describe('parseVaultFiles with the fixture vault', () => {
  const files = readFixtureVault(join(__dirname, 'fixtures', 'vault'))
  const result = expectSuccess(parseVaultFiles(files))

  it('imports one entity per note, falling back to the filename', () => {
    const names = result.entities.map((e) => e.name)
    expect(names).toContain('Alpha Project')
    expect(names).toContain('Beta')
    expect(names).toContain('plain')
    expect(names).toContain('café')
    // Six notes plus two stubs for unresolvable names.
    expect(result.entities).toHaveLength(8)
  })

  it('maps frontmatter onto the entity, warning on unknown keys', () => {
    const alpha = result.entities.find((e) => e.name === 'Alpha Project')
    expect(alpha?.type).toBe('project')
    expect(alpha?.description).toBe('The flagship effort for the fall.')
    expect(alpha?.createdAt).toBe('2026-09-01T10:00:00.000Z')
    expect(alpha?.tags).toEqual(['planning', 'q4', 'Alpha Initiative', 'launch'])
    expect(result.warnings.some((w) => w.includes('obsolete'))).toBe(true)
  })

  it('ignores unparseable dates and keeps the note', () => {
    expect(result.warnings.some((w) => w.includes('not-a-date'))).toBe(true)
    expect(result.entities.filter((e) => e.name === 'Shared Name')).toHaveLength(2)
  })

  it('resolves wikilinks and relative links, stubbing the rest', () => {
    const alpha = result.entities.find((e) => e.name === 'Alpha Project')
    // Resolvable names become mention tokens; unresolvable ones stay as
    // wikilink text AND gain a stub entity for later linking.
    expect(alpha?.content).not.toContain('[[Beta]]')
    expect(alpha?.content).toContain('[[Missing Link]]')
    expect(alpha?.content).toContain('dks://entity/')
    expect(alpha?.content).not.toContain('../Research/Beta.md')
    expect(result.stubNames).toContain('Missing Link')
    expect(result.stubNames).toContain('Gamma Deep Dive')
    const stub = result.entities.find((e) => e.name === 'Missing Link')
    expect(stub?.content).toBe('')
    expect(stub?.type).toBe('concept')
  })

  it('reports same-name notes as conflicts without merging them', () => {
    expect(result.conflicts).toEqual(['Shared Name'])
  })

  it('collects malformed files as warnings instead of failing', () => {
    expect(result.warnings.some((w) => w.includes('broken.md'))).toBe(true)
    expect(result.entities.every((e) => e.name !== '')).toBe(true)
  })

  it('mines claims from note bodies', () => {
    const alpha = result.entities.find((e) => e.name === 'Alpha Project')
    const alphaClaims = result.claims.filter((c) => c.entityId === alpha?.id)
    expect(alphaClaims).toHaveLength(1)
    expect(alphaClaims[0]?.statement).toContain('launches slip')
  })
})

describe('extractHashtags', () => {
  it('skips headings and fenced code', () => {
    expect(extractHashtags('# Title #not-a-tag\nBody with #real.\n```\n#code\n```\n')).toEqual(['real'])
  })

  it('keeps tag order and dedupes', () => {
    expect(extractHashtags('#a then #b then #a')).toEqual(['a', 'b'])
  })
})

describe('checkVaultLimits', () => {
  it('rejects empty batches', () => {
    expect(checkVaultLimits(new Map())).toContain('No Markdown')
  })

  it('rejects batches over the file count', () => {
    const files = new Map<string, string>()
    for (let i = 0; i < MAX_MARKDOWN_FILES + 1; i += 1) files.set(`n${i}.md`, 'x')
    expect(checkVaultLimits(files)).toContain('Too many files')
  })

  it('rejects a single oversized file', () => {
    const files = new Map([['big.md', 'x'.repeat(MAX_MARKDOWN_FILE_BYTES + 1)]])
    expect(checkVaultLimits(files)).toContain('too large')
  })

  it('rejects an oversized total without parsing anything', () => {
    const chunk = 'x'.repeat(1_048_576)
    const files = new Map<string, string>()
    for (let i = 0; i < MAX_MARKDOWN_TOTAL_BYTES / chunk.length + 1; i += 1) {
      files.set(`n${i}.md`, chunk)
    }
    expect(parseVaultFiles(files).success).toBe(false)
  })
})

describe('parseVaultFiles edge cases', () => {
  it('skips non-mapping frontmatter and absolute paths', () => {
    const result = expectSuccess(
      parseVaultFiles(
        new Map([
          ['list.md', '---\n- a\n- b\n---\nbody\n'],
          ['/abs.md', 'body\n'],
          ['ok.md', 'kept\n'],
        ]),
      ),
    )
    expect(result.entities.map((e) => e.id)).toEqual(['ok'])
    expect(result.warnings).toHaveLength(2)
  })

  it('fails closed when nothing is importable', () => {
    expect(parseVaultFiles(new Map([['bad.md', '---\n[unclosed\n---\n']])).success).toBe(false)
  })

  it('leaves images, absolute URLs, and anchors literal', () => {
    const result = expectSuccess(
      parseVaultFiles(
        new Map([
          ['a.md', '![alt](./pic.png)\n[ext](https://example.com/x.md)\n[t](./b.md#frag)\n'],
          ['b.md', 'target\n'],
        ]),
      ),
    )
    const a = result.entities.find((e) => e.id === 'a')
    expect(a?.content).toContain('![alt](./pic.png)')
    expect(a?.content).toContain('https://example.com/x.md')
    expect(a?.content).not.toContain('./b.md')
  })

  it('ignores unknown vault types with a warning', () => {
    const files = new Map<string, string>([['a.md', '---\ntype: ephemeral\n---\n']])
    const result = expectSuccess(parseVaultFiles(files))
    expect(result.entities[0]?.type).toBe('concept')
    expect(result.warnings.some((w) => w.includes('ephemeral'))).toBe(true)
  })
})
