import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readZip } from './zip.js'

/** Minimal zip builder for fixtures: stored or raw-deflate entries. */
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
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0, true) // flags
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
    cv.setUint16(8, 0, true)
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

/** Locates the central directory start (used to corrupt header fields). */
const findCentralDirectory = (zip: Uint8Array): number => {
  for (let i = 0; i <= zip.length - 46; i += 1) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x01 && zip[i + 3] === 0x02) return i
  }
  throw new Error('central directory not found')
}
describe('readZip', () => {
  it('reads stored and deflated entries in order', () => {
    const zip = buildZip([
      { name: 'a.txt', data: new TextEncoder().encode('hello'), method: 0 },
      { name: 'b.txt', data: new TextEncoder().encode('world world world'), method: 8 },
    ])
    const entries = readZip(zip)
    expect([...entries.keys()]).toEqual(['a.txt', 'b.txt'])
    expect(new TextDecoder().decode(entries.get('a.txt'))).toBe('hello')
    expect(new TextDecoder().decode(entries.get('b.txt'))).toBe('world world world')
  })

  it('returns an empty map for an archive with no entries', () => {
    expect(readZip(buildZip([])).size).toBe(0)
  })

  it('throws on truncated input', () => {
    const zip = buildZip([{ name: 'a.txt', data: new TextEncoder().encode('x') }])
    expect(() => readZip(zip.slice(0, 12))).toThrow()
  })

  it('throws on unsupported compression methods', () => {
    const zip = buildZip([{ name: 'a.txt', data: new TextEncoder().encode('x'), method: 8 }])
    // Patch the method to 99 in both headers (local + central).
    const patched = zip.slice()
    const cd = findCentralDirectory(patched)
    patched[8] = 99
    patched[cd + 10] = 99
    expect(() => readZip(patched)).toThrow(/unsupported compression method/)
  })

  it('throws when the decompressed size does not match the header', () => {
    const zip = buildZip([{ name: 'a.txt', data: new TextEncoder().encode('x'), method: 8 }])
    // Corrupt the uncompressed-size field in the central directory header.
    const patched = zip.slice()
    const cd = findCentralDirectory(patched)
    patched[cd + 24] = 0xff
    expect(() => readZip(patched)).toThrow(/size mismatch/)
  })
})
