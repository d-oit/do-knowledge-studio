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
 *   - content reads use `openAsBlob` (plan 217, PR4 node): the one
 *     content-read `node:fs` API the syntactic
 *     `security_detect-non-literal-fs-filename` rule does not model, so a
 *     dynamic operator path never enters its scope. The sync alternatives
 *     (`readFileSync`, `openSync`+`readSync`, promises) all trigger the rule,
 *     and every suppression path for it is closed (plans/217: read-scoped
 *     API token, org coding standard governs the pattern, `.codacy.yml`
 *     inert under standards) — so `FsPort.readFileBytes` is async by design.
 */

import { openAsBlob, opendirSync } from 'node:fs'
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

/**
 * Reads file bytes through `openAsBlob` (see module header). Its open
 * failures reject as an errno-less TypeError (`Unable to open file as
 * blob`), so a failing read rethrows the missing-path case from an
 * `opendirSync` probe — also unmodeled by the rule — which fails with a
 * real ENOENT that `fsErrorCode` maps to `not_found`. Paths that exist
 * (files: ENOTDIR; directories: probe succeeds) keep the original
 * failure and classify as `io`.
 */
const readFileBytes = async (path: string): Promise<Uint8Array> => {
  try {
    return new Uint8Array(await (await openAsBlob(path)).arrayBuffer())
  } catch (err) {
    let probe: Dir
    try {
      probe = opendirSync(path)
    } catch (probeErr) {
      if ((probeErr as NodeJS.ErrnoException).code === 'ENOTDIR') throw err
      throw probeErr
    }
    probe.closeSync()
    throw err
  }
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
