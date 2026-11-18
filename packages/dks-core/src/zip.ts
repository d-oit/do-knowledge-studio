/**
 * Minimal dependency-free ZIP reader used to open OKF bundle archives.
 *
 * Supports the two compression methods used by the studio's OKF export
 * (fflate writes raw deflate): method 0 (stored) and method 8 (deflate).
 * Anything else fails closed. Zip64 is not supported; all accepted inputs
 * are bounded well below 4 GiB by the caller's caps.
 */

import { inflateRawSync } from 'node:zlib'

/** Central directory file header signature. */
const CD_ENTRY_SIG = 0x02014b50
/** End of central directory signature. */
const EOCD_SIG = 0x06054b50
/** Local file header signature. */
const LOCAL_HEADER_SIG = 0x04034b50

/** A single zip entry name → decompressed bytes. */
export type ZipEntries = Map<string, Uint8Array>

/** Reads a 16-bit little-endian unsigned int at `offset`. */
const u16 = (b: Uint8Array, offset: number): number =>
  (b.at(offset) ?? 0) | ((b.at(offset + 1) ?? 0) << 8)

/** Reads a 32-bit little-endian unsigned int at `offset`. */
const u32 = (b: Uint8Array, offset: number): number =>
  ((b.at(offset) ?? 0) |
    ((b.at(offset + 1) ?? 0) << 8) |
    ((b.at(offset + 2) ?? 0) << 16) |
    ((b.at(offset + 3) ?? 0) << 24)) >>>
  0

/** Locates the end-of-central-directory record from the buffer tail. */
const findEocd = (buffer: Uint8Array): { offset: number; count: number } => {
  const max = Math.min(buffer.length, 65_557)
  for (let i = buffer.length - 22; i >= buffer.length - max; i -= 1) {
    if (i < 0) break
    if (u32(buffer, i) === EOCD_SIG) {
      const count = u16(buffer, i + 10)
      const cdOffset = u32(buffer, i + 16)
      return { offset: cdOffset, count }
    }
  }
  throw new Error('Not a valid zip archive (missing end-of-central-directory record).')
}

/** Decodes the UTF-8 name of an entry, rejecting malformed sequences. */
const decodeName = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Zip entry name is not valid UTF-8.')
  }
}

/**
 * Reads all entries from a zip buffer. Path traversal and size caps are the
 * caller's responsibility (they own the bundle safety limits).
 * @param buffer - Raw zip bytes.
 * @returns Entry name → decompressed bytes, in archive order.
 */
export const readZip = (buffer: Uint8Array): ZipEntries => {
  const eocd = findEocd(buffer)
  if (eocd.count === 0) return new Map()
  let cursor = eocd.offset
  const entries: ZipEntries = new Map()
  for (let n = 0; n < eocd.count; n += 1) {
    if (u32(buffer, cursor) !== CD_ENTRY_SIG) {
      throw new Error('Zip central directory is corrupted.')
    }
    const method = u16(buffer, cursor + 10)
    const compressedSize = u32(buffer, cursor + 20)
    const uncompressedSize = u32(buffer, cursor + 24)
    const nameLen = u16(buffer, cursor + 28)
    const extraLen = u16(buffer, cursor + 30)
    const commentLen = u16(buffer, cursor + 32)
    const localOffset = u32(buffer, cursor + 42)
    const name = decodeName(buffer.subarray(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen

    if (u32(buffer, localOffset) !== LOCAL_HEADER_SIG) {
      throw new Error(`Zip local header is corrupted for entry "${name}".`)
    }
    const localNameLen = u16(buffer, localOffset + 26)
    const localExtraLen = u16(buffer, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const data = buffer.subarray(dataStart, dataStart + compressedSize)

    let out: Uint8Array
    if (method === 0) {
      out = data
    } else if (method === 8) {
      try {
        out = inflateRawSync(data)
      } catch {
        throw new Error(`Zip entry "${name}" failed to decompress.`)
      }
    } else {
      throw new Error(`Zip entry "${name}" uses unsupported compression method ${method}.`)
    }
    if (out.byteLength !== uncompressedSize) {
      throw new Error(`Zip entry "${name}" size mismatch after decompression.`)
    }
    entries.set(name, out)
  }
  return entries
}
