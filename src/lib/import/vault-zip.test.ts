import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { MAX_VAULT_UNCOMPRESSED_BYTES, MAX_VAULT_ZIP_BYTES } from './markdown-import'
import { readVaultZip, sanitizeZipPath } from './vault-zip'

/** Zips an in-memory path → content map the way a vault archive would hold it. */
const makeZip = (files: Record<string, string>): ArrayBuffer => {
  const entries: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content)
  return zipSync(entries).buffer as ArrayBuffer
}

describe('readVaultZip', () => {
  it('reads note files and skips directories and non-notes', async () => {
    const result = await readVaultZip(
      makeZip({
        'notes/a.md': '# A',
        'notes/pic.png': 'binary',
        'empty-dir/': '',
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)
    expect([...result.files.keys()]).toEqual(['notes/a.md'])
  })

  it('normalizes backslashes and strips the OKF root prefix', async () => {
    const result = await readVaultZip(makeZip({ 'okf-bundle\\concepts\\ok.md': '# OK' }))
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)
    expect([...result.files.keys()]).toEqual(['concepts/ok.md'])
  })

  it('rejects an over-compressed-size archive before reading', async () => {
    const result = await readVaultZip(new Uint8Array(MAX_VAULT_ZIP_BYTES + 1).buffer)
    expect(result.success).toBe(false)
  })

  it('fails closed on a zip bomb instead of materializing it', async () => {
    const bomb = makeZip({ 'bomb.md': '0'.repeat(MAX_VAULT_UNCOMPRESSED_BYTES + 1_048_576) })
    expect(bomb.byteLength).toBeLessThan(MAX_VAULT_ZIP_BYTES)
    const result = await readVaultZip(bomb)
    expect(result.success).toBe(false)
    if (result.success) throw new Error('zip bomb was accepted')
    expect(result.error).toContain('safety limit')
  })

  it('rejects archives with too many entries', async () => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < 2_001; i += 1) entries[`n${i}.md`] = 'x'
    const result = await readVaultZip(makeZip(entries))
    expect(result.success).toBe(false)
  })

  it('reports corrupt archives instead of throwing', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4, 255, 255, 255, 255])
    expect((await readVaultZip(bytes.buffer)).success).toBe(false)
  })
})

describe('sanitizeZipPath (re-exported for the import handler)', () => {
  it('keeps vault-relative paths and rejects traversal', () => {
    expect(sanitizeZipPath('notes/a.md')).toBe('notes/a.md')
    expect(sanitizeZipPath('../evil.md')).toBeNull()
    expect(sanitizeZipPath('')).toBeNull()
  })
})
