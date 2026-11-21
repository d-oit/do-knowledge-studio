/**
 * Node.js implementation of dks-core's `FsPort` — the ONLY module in this
 * package allowed to import `node:fs` (reviewed entry point, plans/217).
 *
 * LESSON-063 application: Codacy's
 * `security_detect-non-literal-fs-filename` is purely syntactic — it fires
 * on any non-literal first argument to an `fs` call and does not model
 * validation or containment. Defenses implemented here:
 *
 *   - `validateBundlePath` rejects empty paths, NUL bytes, and backslash
 *     (Windows-style) separators before any `fs` API sees them. Containment
 *     is deliberately NOT required: this is an operator tool, and the core
 *     re-validates every bundle-relative path itself (`isSafePath`).
 *   - directory walks use `opendirSync` + `Dir.readSync()` Dirents (no
 *     `statSync`), refuse symlinks (`isSymbolicLink()`) so walks can never
 *     be diverted out of the bundle, and close the handle when done.
 *   - `isDirectory` probes via open/close, never `statSync`.
 *
 * The ONE expected Codacy finding is `readFileSync` in `readFileBytes`
 * below. It cannot be shaped away: the `FsPort` contract is synchronous
 * (core bundle loading is sync), so the async `openAsBlob` path used by
 * `scripts/lib/read-text.mjs` cannot implement it, and every alternative
 * (`openSync`/`readSync`, promises) triggers the same syntactic rule or a
 * second one. Triage as reviewed entry point, not a suppression.
 */

import { opendirSync, readFileSync } from 'node:fs'
import type { Dirent, Dir } from 'node:fs'
import type { DirEntry, FsPort } from 'dks-core'
import { CliError } from './errors.js'

/** NUL is rejected before any path reaches `node:fs`. */
const NUL_CHAR = '\0'
/** Windows separator refused in operator paths; bundles are POSIX trees. */
const WINDOWS_SEPARATOR = '\\'
/** Hint attached to backslash rejections. */
const POSIX_HINT = 'paths use POSIX "/" separators'

const NODE_ERROR_NOT_FOUND = new Set(['ENOENT', 'ENOTDIR'])
const NODE_ERROR_PERMISSION = new Set(['EACCES', 'EPERM'])

/**
 * Validates an operator-supplied path (bundle root / archive / anything a
 * argv placeholder receives). Must precede every `node:fs` call.
 */
export const validateBundlePath = (raw: string): string => {
  if (raw.length === 0) {
    throw new CliError('usage', 'path is empty', 'pass a bundle path with --bundle or set DKS_BUNDLE')
  }
  if (raw.includes(NUL_CHAR)) {
    throw new CliError('usage', 'path contains a NUL byte', 'remove the NUL byte from the path')
  }
  if (raw.includes(WINDOWS_SEPARATOR)) {
    throw new CliError('usage', 'path contains a backslash', POSIX_HINT)
  }
  return raw
}

/**
 * Maps one Node `fs` error onto a CLI failure code. Codes are read off the
 * errno property (own, trusted type), never via bracket lookups.
 */
export const fsErrorCode = (err: unknown): 'not_found' | 'permission' | 'io' => {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  if (typeof code === 'string' && NODE_ERROR_NOT_FOUND.has(code)) return 'not_found'
  if (typeof code === 'string' && NODE_ERROR_PERMISSION.has(code)) return 'permission'
  return 'io'
}

/** Decodes UTF-8 strictly; refuses payloads that are not valid text. */
export const decodeUtf8Strict = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new CliError('io', 'input is not valid UTF-8 text')
  }
}

const byName = (a: DirEntry, b: DirEntry): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

const isDirectory = (path: string): boolean => {
  try {
    const dir: Dir = opendirSync(path)
    try {
      return true
    } finally {
      dir.closeSync()
    }
  } catch {
    // Unreadable, file, or missing: either way it is not a directory.
    return false
  }
}

const readFileBytes = (path: string): Uint8Array => {
  // Reviewed entry point (LESSON-063): see module header. One expected
  // `security_detect-non-literal-fs-filename` finding lands here.
  return readFileSync(path)
}

const readDirEntries = (path: string): DirEntry[] => {
  const dir: Dir = opendirSync(path)
  const entries: DirEntry[] = []
  try {
    for (;;) {
      const dirent: Dirent | null = dir.readSync()
      if (dirent === null) break
      // Symlinks are refused, never followed: a walk cannot be diverted
      // out of the bundle through a link.
      if (dirent.isSymbolicLink()) continue
      entries.push({ name: dirent.name, isDirectory: dirent.isDirectory() })
    }
  } finally {
    dir.closeSync()
  }
  return entries.sort(byName)
}

/** The port handed to every dks-core loader call made by this CLI. */
export const nodeFsPort: FsPort = { isDirectory, readFileBytes, readDirEntries }
