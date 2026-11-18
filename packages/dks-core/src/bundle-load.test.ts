import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadBundleFromDisk } from './bundle-load.js'
import type { DirEntry, FsPort } from './io.js'

/** In-memory filesystem double: paths are plain keys; dirs end with "/". */
const makeMemoryFs = (files: Record<string, string | Uint8Array>): FsPort => {
  const blob = new Map<string, Uint8Array>()
  const dirs = new Set<string>(['/'])
  for (const [path, text] of Object.entries(files)) {
    blob.set(path, typeof text === 'string' ? new TextEncoder().encode(text) : text)
    const parts = path.split('/').filter(Boolean).slice(0, -1)
    let acc = '/'
    for (const part of parts) {
      acc += part
      dirs.add(acc)
      acc += '/'
    }
  }
  return {
    isDirectory(path) {
      return dirs.has(path.endsWith('/') ? path : `${path}/`) || dirs.has(path)
    },
    readFileBytes(path) {
      const bytes = blob.get(path)
      if (!bytes) throw new Error(`ENOENT: ${path}`)
      return bytes
    },
    readDirEntries(path) {
      const prefix = path.endsWith('/') ? path : `${path}/`
      const names = new Set<string>()
      for (const key of blob.keys()) {
        if (!key.startsWith(prefix)) continue
        const top = key.slice(prefix.length).split('/')[0]
        if (top) names.add(top)
      }
      for (const dir of dirs) {
        if (!dir.startsWith(prefix) || dir === prefix) continue
        const top = dir.slice(prefix.length).split('/')[0]
        if (top) names.add(top)
      }
      const entries: DirEntry[] = []
      for (const name of names) {
        entries.push({ name, isDirectory: dirs.has(`${prefix}${name}`) || dirs.has(`${prefix}${name}/`) })
      }
      return entries.sort((a, b) => a.name.localeCompare(b.name))
    },
  }
}

/** Minimal zip builder for the zip-input tests. */
const buildZip = (entries: Array<{ name: string; data: Uint8Array; method?: 0 | 8 }>): Uint8Array => {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const method = entry.method ?? 8
    const data = method === 8 ? deflateRawSync(entry.data) : entry.data
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, method, true)
    lv.setUint32(14, data.length, true)
    lv.setUint32(18, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)
    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(10, method, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)
    offset += local.length
  }
  const cdStart = locals.reduce((acc, l) => acc + l.length, 0)
  const cdBytes = new Uint8Array(central.reduce((acc, c) => acc + c.length, 0))
  let pos = 0
  for (const c of central) {
    cdBytes.set(c, pos)
    pos += c.length
  }
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdBytes.length, true)
  ev.setUint32(16, cdStart, true)
  const out = new Uint8Array(cdStart + cdBytes.length + 22)
  pos = 0
  for (const l of locals) {
    out.set(l, pos)
    pos += l.length
  }
  out.set(cdBytes, pos)
  out.set(eocd, pos + cdBytes.length)
  return out
}

const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`
const ALPHA = `---\ntype: Project\ntitle: Alpha\nverified:\n  by: human:ada\n---\nAlpha body.\n# Claims\n\n- Alpha works\n`
const BETA = `---\ntype: Concept\ntitle: Beta\n---\nBeta body.\n`

describe('loadBundleFromDisk (directory)', () => {
  it('loads a directory tree with reserved-file handling', () => {
    const fs = makeMemoryFs({
      '/bundle/index.md': INDEX,
      '/bundle/log.md': '# Log\n',
      '/bundle/concepts/alpha.md': ALPHA,
      '/bundle/concepts/beta.md': BETA,
      '/bundle/assets/logo.png': 'not markdown',
    })
    const loaded = loadBundleFromDisk(fs, '/bundle')
    expect(loaded.concepts.map((c) => c.id)).toEqual(['concepts/alpha', 'concepts/beta'])
    expect(loaded.concepts[0]?.trustTier).toBe('human-reviewed')
  })

  it('skips unsafe relative paths', () => {
    const fs = makeMemoryFs({
      '/bundle/index.md': INDEX,
      '/bundle/concepts/alpha.md': ALPHA,
      '/bundle/../escape.md': '# escape\n',
    })
    const loaded = loadBundleFromDisk(fs, '/bundle')
    expect(loaded.concepts.map((c) => c.id)).toEqual(['concepts/alpha'])
  })

  it('throws when the target is missing', () => {
    const fs = makeMemoryFs({})
    expect(() => loadBundleFromDisk(fs, '/nope')).toThrow()
  })

  it('throws on bundles without a valid index', () => {
    const fs = makeMemoryFs({ '/bundle/concepts/alpha.md': ALPHA })
    expect(() => loadBundleFromDisk(fs, '/bundle')).toThrow(/index\.md with okf_version/)
  })
})

describe('loadBundleFromDisk (zip)', () => {
  const zipBytes = buildZip([
    { name: 'okf-bundle/index.md', data: new TextEncoder().encode(INDEX) },
    { name: 'okf-bundle/log.md', data: new TextEncoder().encode('# Log\n') },
    { name: 'okf-bundle/concepts/alpha.md', data: new TextEncoder().encode(ALPHA) },
    { name: 'okf-bundle/concepts/beta.md', data: new TextEncoder().encode(BETA) },
    { name: 'okf-bundle/assets/logo.png', data: new TextEncoder().encode('PNG'), method: 0 },
  ])

  it('loads a zip bundle and strips the export prefix', () => {
    const fs = makeMemoryFs({ '/bundle.zip': zipBytes })
    const loaded = loadBundleFromDisk(fs, '/bundle.zip')
    expect(loaded.concepts.map((c) => c.id)).toEqual(['concepts/alpha', 'concepts/beta'])
  })

  it('rejects oversized zips', () => {
    const big = new Uint8Array(11_000_000)
    const fs = makeMemoryFs({ '/big.zip': big })
    expect(() => loadBundleFromDisk(fs, '/big.zip')).toThrow(/too large/)
  })
})
