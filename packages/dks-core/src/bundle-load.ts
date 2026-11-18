/**
 * Loads an OKF bundle from disk (zip file or directory) through an
 * {@link FsPort}. Size, entry-count, decompressed-total, and path-safety
 * guards mirror the studio vault-zip caps; every guard fails closed before
 * any concept is parsed.
 */

import type { FsPort } from './io.js'
import { isSafePath, parseBundleFiles } from './okf-parse.js'
import {
  EXPORT_PREFIX,
  MAX_BUNDLE_ENTRIES,
  MAX_BUNDLE_UNCOMPRESSED_BYTES,
  MAX_BUNDLE_ZIP_BYTES,
  MAX_CONCEPT_BYTES,
} from './types.js'
import type { LoadedBundle } from './types.js'
import { readZip } from './zip.js'

/** Decodes UTF-8 bytes; null when the payload is not valid UTF-8. */
const decodeUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Reads zip entries into a bundle-relative path → UTF-8 content map. */
const readZipEntries = (buffer: Uint8Array): Map<string, string> => {
  if (buffer.byteLength > MAX_BUNDLE_ZIP_BYTES) {
    throw new Error(`Bundle zip is too large; limited to ${MAX_BUNDLE_ZIP_BYTES} bytes compressed.`)
  }
  const entries = readZip(buffer)
  if (entries.size > MAX_BUNDLE_ENTRIES) {
    throw new Error(`Too many entries in the bundle; limited to ${MAX_BUNDLE_ENTRIES} files.`)
  }
  const files = new Map<string, string>()
  let total = 0
  for (const [name, bytes] of entries) {
    if (name.endsWith('/')) continue
    total += bytes.byteLength
    if (bytes.byteLength > MAX_CONCEPT_BYTES || total > MAX_BUNDLE_UNCOMPRESSED_BYTES) {
      throw new Error('Decompressed bundle exceeds the safety limit; refusing to serve.')
    }
    const stripped = name.startsWith(EXPORT_PREFIX) ? name.slice(EXPORT_PREFIX.length) : name
    if (!stripped || !isSafePath(stripped)) continue
    if (!stripped.endsWith('.md')) continue
    // Decode only markdown entries; binary siblings (images, assets) are
    // ignored and must not fail the bundle over a non-UTF-8 payload.
    const text = decodeUtf8(bytes)
    if (text !== null) files.set(stripped, text)
  }
  return files
}

/** Reads a directory tree into a bundle-relative path → content map. */
const readDirectoryEntries = (port: FsPort, dir: string): Map<string, string> => {
  const files = new Map<string, string>()
  let total = 0
  const walk = (current: string, prefix: string): void => {
    const names = port.readDirEntries(current)
    for (const entry of names) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (!isSafePath(rel)) continue
      if (entry.isDirectory) {
        walk(`${current}/${entry.name}`, rel)
      } else if (entry.name.endsWith('.md')) {
        const content = decodeUtf8(port.readFileBytes(`${current}/${entry.name}`))
        if (content === null) continue
        total += content.length
        if (content.length > MAX_CONCEPT_BYTES || total > MAX_BUNDLE_UNCOMPRESSED_BYTES) {
          throw new Error('Bundle exceeds the safety limit; refusing to serve.')
        }
        if (files.size >= MAX_BUNDLE_ENTRIES) {
          throw new Error(`Too many files in the bundle; limited to ${MAX_BUNDLE_ENTRIES}.`)
        }
        files.set(rel, content)
      }
    }
  }
  walk(dir, '')
  return files
}

/**
 * Loads and parses a bundle from a zip file or a directory.
 * Fail-closed: unreadable input, missing/incompatible index, or guard
 * violations throw before any concept is served.
 * @param port - Filesystem port (Node or test double).
 * @param target - Path to a `.zip` bundle or a directory of `.md` files.
 * @returns The loaded concepts plus non-fatal warnings.
 */
export const loadBundleFromDisk = (port: FsPort, target: string): LoadedBundle => {
  const files = port.isDirectory(target)
    ? readDirectoryEntries(port, target)
    : readZipEntries(port.readFileBytes(target))
  return parseBundleFiles(files)
}
