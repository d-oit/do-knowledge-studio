/**
 * MCP bundle loader: the adapter's only own logic is the Node `FsPort`, so
 * these tests drive the real filesystem through `dks-core`'s loader and pin
 * the OKF semantics MCP clients observe (claims, sources, reserved files,
 * path guards, fail-closed guards).
 */
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_BUNDLE_ZIP_BYTES } from 'dks-core'
import { afterEach, describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { loadBundle } from './bundle-reader.js'

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
const ALPHA = `---\ntype: Project\ntitle: Alpha Project\ndescription: First project\ntags:\n  - research\n  - alpha\nsources:\n  - id: src-1\n    resource: https://example.com/alpha\n    title: Alpha paper\n    author: human:ada\nverified:\n  by: human:ada\n  at: '2026-01-02T00:00:00.000Z'\nunknown_future_key: tolerated\n---\n\nBody text about alpha.\n\n# Claims\n\n- Alpha scales linearly[^src-1]\n- Alpha is cheap\n\n[^src-1]: Alpha paper\n\n# Related\n\n* [Beta](/concepts/beta)\n* [Ghost](/concepts/ghost)\n`

/** Machine-confirmed concept with no claims. */
const BETA = `---\ntype: Concept\ntitle: Beta\nverified:\n  - by: process:do-knowledge-studio/0.2.0\n---\n\nBeta body.\n`

describe('loadBundle from a directory', () => {
  it('loads concepts, claims, sources, and related ids', async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'concepts'), { recursive: true })
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'log.md'), LOG)
    writeFileSync(join(dir, 'concepts', 'alpha.md'), ALPHA)
    writeFileSync(join(dir, 'concepts', 'beta.md'), BETA)

    const { concepts, warnings } = await loadBundle(dir)
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

  it('warns on frontmatter-less files and rejects empty bundles', async () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'broken.md'), 'no frontmatter here\n')

    await expect(loadBundle(dir)).rejects.toThrow(/no parseable concepts/)
  })

  it('rejects bundles without a versioned index', async () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), '# no version\n')
    writeFileSync(join(dir, 'a.md'), ALPHA)

    await expect(loadBundle(dir)).rejects.toThrow(/index\.md with okf_version/)
  })

  it('rejects unsupported bundle versions', async () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'index.md'), `---\nokf_version: '9.9'\n---\n`)
    writeFileSync(join(dir, 'a.md'), ALPHA)

    await expect(loadBundle(dir)).rejects.toThrow(/Unsupported okf_version/)
  })

  it('loads nested directories with bundle-relative ids', async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'index.md'), INDEX)
    writeFileSync(join(dir, 'sub', 'nested.md'), BETA)
    writeFileSync(join(dir, 'ok.md'), ALPHA)

    const { concepts } = await loadBundle(dir)
    expect(concepts.map((c) => c.id).sort()).toEqual(['ok', 'sub/nested'])
  })

  it('rejects a missing path', async () => {
    const dir = makeTempDir()

    await expect(loadBundle(join(dir, 'absent'))).rejects.toThrow(/ENOENT|no such file/i)
  })

  it.skipIf(process.getuid?.() === 0)(
    'keeps the read error for an existing file instead of the probe ENOTDIR',
    async () => {
      // An unreadable existing file used to surface the opendir probe's
      // "not a directory" (ENOTDIR) instead of the failed read itself.
      const dir = makeTempDir()
      const target = join(dir, 'bundle.zip')
      writeFileSync(target, 'not a zip')
      chmodSync(target, 0o000)

      try {
        await loadBundle(target)
        expect.unreachable('expected the unreadable bundle to reject')
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).not.toBe('ENOTDIR')
        expect(String((err as Error).message)).not.toMatch(/not a directory/i)
      }
    },
  )
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

  it('reads prefixed entries and skips zip-slip names', async () => {
    const dir = makeTempDir()
    const zip = zipOf({
      'index.md': INDEX,
      'concepts/alpha.md': ALPHA,
      '../evil.md': ALPHA,
      '/absolute.md': ALPHA,
    })
    const target = join(dir, 'bundle.zip')
    writeFileSync(target, zip)

    const { concepts, warnings } = await loadBundle(target)
    expect(concepts.map((c) => c.id)).toEqual(['concepts/alpha'])
    expect(warnings).toEqual([])
  })

  it('rejects oversized zips fail-closed', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'bundle.zip')
    writeFileSync(target, Buffer.alloc(MAX_BUNDLE_ZIP_BYTES + 1))

    await expect(loadBundle(target)).rejects.toThrow(/too large/)
  })
})
