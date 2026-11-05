import {
  MAX_VAULT_UNCOMPRESSED_BYTES,
  MAX_VAULT_ZIP_BYTES,
  MAX_VAULT_ZIP_ENTRIES,
} from './markdown-import'

/**
 * Vault `.zip` reading (issue #1054) — pure except for the dynamic `fflate`
 * import, which keeps the decompressor out of the main bundle.
 *
 * The zip-bomb guard is structural, not post-hoc: entries stream through
 * `fflate`'s `Unzip` + `UnzipInflate` chunk by chunk, and both the per-file
 * and running totals abort the batch the moment they pass
 * `MAX_VAULT_UNCOMPRESSED_BYTES`. A fully-buffered `unzipSync` would have to
 * hold the bomb in memory before any cap could fire.
 */

/** File extensions treated as importable notes. */
const MARKDOWN_EXTENSIONS = ['.md', '.markdown']

/** True for directory entries and non-note files. */
const isSkippableEntry = (path: string): boolean =>
  path.endsWith('/') ||
  !MARKDOWN_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))

/**
 * Sanitizes a zip entry path to prevent Zip Slip / path traversal.
 * Normalizes separators, strips optional root prefix, and rejects path
 * traversal (`..` or `.`).
 * @param path - Raw entry path from zip archive.
 * @returns Clean relative path, or null if the path contains traversal sequences or is invalid.
 */
export const sanitizeZipPath = (path: string): string | null => {
  if (!path || typeof path !== 'string') return null
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '')
  const stripped = normalized.replace(/^okf-bundle\//, '')
  const segments = stripped.split('/')
  const safeSegments: string[] = []
  for (const seg of segments) {
    if (seg === '..' || seg === '.') return null
    // Leading-slash roots ('//etc/passwd' → 'etc/passwd') and doubled
    // separators ('concepts//x.md') collapse to empty segments; an entry that
    // is *entirely* separators has no usable filename, so treat it as invalid
    // rather than resurrecting a hidden path.
    if (seg !== '') safeSegments.push(seg)
  }
  if (safeSegments.length === 0) return null
  return safeSegments.join('/')
}

/** Result of reading a vault `.zip` into a path → content map. */
export type VaultZipResult =
  | { success: true; files: Map<string, string> }
  | { success: false; error: string }

/**
 * Reads a vault `.zip` buffer into a sanitized path → content map, enforcing
 * the compressed-size, entry-count, and streaming decompressed-size caps.
 * Never throws: every failure mode becomes a `success: false` error string.
 */
export const readVaultZip = async (buffer: ArrayBuffer): Promise<VaultZipResult> => {
  if (buffer.byteLength > MAX_VAULT_ZIP_BYTES) {
    return {
      success: false,
      error: `Zip is too large (${buffer.byteLength} bytes); vault zips are limited to ${MAX_VAULT_ZIP_BYTES} bytes compressed.`,
    }
  }
  let fflate: typeof import('fflate')
  try {
    fflate = await import('fflate')
  } catch {
    return { success: false, error: 'Could not load the zip reader.' }
  }

  const files = new Map<string, string>()
  let entryCount = 0
  let decompressedTotal = 0
  let failure: string | null = null

  await new Promise<void>((resolve) => {
    const unzip = new fflate.Unzip()
    unzip.register(fflate.UnzipInflate)
    unzip.onfile = (entry) => {
      entryCount += 1
      if (entryCount > MAX_VAULT_ZIP_ENTRIES) {
        failure = `Too many entries in the zip; vault zips are limited to ${MAX_VAULT_ZIP_ENTRIES} files.`
        resolve()
        return
      }
      const safePath = sanitizeZipPath(entry.name)
      if (!safePath || isSkippableEntry(safePath)) {
        entry.ondata = () => {}
        entry.start()
        return
      }
      const chunks: Uint8Array[] = []
      let fileBytes = 0
      entry.ondata = (error, data, final) => {
        if (failure !== null) return
        if (error) {
          failure = `"${safePath}": could not decompress (${error.message}).`
          resolve()
          return
        }
        fileBytes += data.length
        decompressedTotal += data.length
        if (fileBytes > MAX_VAULT_UNCOMPRESSED_BYTES || decompressedTotal > MAX_VAULT_UNCOMPRESSED_BYTES) {
          // Zip-bomb guard: abort before the batch — nothing parsed yet, so
          // there is no partial state to roll back.
          failure = `Decompressed content exceeds the ${MAX_VAULT_UNCOMPRESSED_BYTES}-byte safety limit; refusing to import.`
          resolve()
          return
        }
        chunks.push(data)
        if (final) {
          const merged = new Uint8Array(fileBytes)
          let offset = 0
          for (const chunk of chunks) {
            merged.set(chunk, offset)
            offset += chunk.length
          }
          try {
            files.set(safePath, fflate.strFromU8(merged))
          } catch {
            failure = `"${safePath}": not decodable as UTF-8 text.`
            resolve()
          }
        }
      }
      entry.start()
    }
    try {
      unzip.push(new Uint8Array(buffer), true)
      // A clean stream ends when the final entry's ondata fires with
      // final=true; resolve idempotently in case onfile already resolved.
      resolve()
    } catch (error) {
      failure = error instanceof Error ? `Invalid zip file (${error.message}).` : 'Invalid zip file.'
      resolve()
    }
  })

  if (failure !== null) return { success: false, error: failure }
  // Garbage bytes stream through with zero entries and no error — an empty
  // note set is a failure here, not a silent no-op the caller must recheck.
  if (files.size === 0) return { success: false, error: 'No Markdown files found in the zip.' }
  return { success: true, files }
}
