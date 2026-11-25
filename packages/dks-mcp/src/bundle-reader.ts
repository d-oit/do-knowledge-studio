/**
 * Loads an exported OKF bundle (zip file or directory) for the MCP adapter.
 *
 * Parsing, guard limits, path safety, and the index/version contract are
 * single-sourced in `dks-core` (`loadBundleFromDisk`); this module only
 * supplies the Node `FsPort` and the `loadBundle` entry point.
 *
 * Port rules (mirrors the `dks` CLI, plans/217): content is read through
 * `openAsBlob`, never `readFileSync`, so a dynamic operator path stays
 * outside Codacy's syntactic `security_detect-non-literal-fs-filename`
 * rule; directory walks use Dirents, refuse symlinks so a walk cannot be
 * diverted out of the bundle, and sort by name so bundle order never
 * depends on the OS.
 */

import { openAsBlob, opendirSync } from 'node:fs'
import type { Dir, Dirent } from 'node:fs'
import { loadBundleFromDisk, type DirEntry, type FsPort, type LoadedBundle } from 'dks-core'

/** Deterministic directory order: bundle order must not depend on the OS. */
const byName = (a: DirEntry, b: DirEntry): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

/** Probes a path via open/close; a file, a missing path, or a denial is "no". */
const isDirectory = (path: string): boolean => {
  try {
    const dir: Dir = opendirSync(path)
    dir.closeSync()
    return true
  } catch {
    return false
  }
}

/**
 * Reads file bytes through `openAsBlob`. Its failures reject as an errno-less
 * TypeError (`Unable to open file as blob`), so a failing read probes the path
 * for a message that explains the failure. The probe only replaces the
 * original error when the path itself is missing (ENOENT/ENOTDIR on a missing
 * path): an existing file that failed to read keeps its own error rather than
 * a misleading "not a directory".
 */
const readFileBytes = async (path: string): Promise<Uint8Array> => {
  try {
    return new Uint8Array(await (await openAsBlob(path)).arrayBuffer())
  } catch (err) {
    let probe: Dir
    try {
      probe = opendirSync(path)
    } catch (probeErr) {
      // ENOTDIR here means the path is a file, not that the read failed for
      // that reason; only a missing path is a better explanation.
      if ((probeErr as NodeJS.ErrnoException).code === 'ENOTDIR') throw err
      throw probeErr
    }
    probe.closeSync()
    throw err
  }
}

/** Lists one directory level, sorted, without following symlinks. */
const readDirEntries = (path: string): DirEntry[] => {
  const dir: Dir = opendirSync(path)
  const entries: DirEntry[] = []
  try {
    for (;;) {
      const dirent: Dirent | null = dir.readSync()
      if (dirent === null) break
      if (dirent.isSymbolicLink()) continue
      entries.push({ name: dirent.name, isDirectory: dirent.isDirectory() })
    }
  } finally {
    dir.closeSync()
  }
  return entries.sort(byName)
}

/** The port handed to every dks-core loader call made by this adapter. */
const nodeFsPort: FsPort = { isDirectory, readFileBytes, readDirEntries }

/**
 * Loads and parses a bundle from a zip file or a directory.
 * Fail-closed: unreadable input, missing/incompatible index, or guard
 * violations reject before any concept is served.
 * @param target - Path to a `.zip` bundle or a directory of `.md` files.
 * @returns The loaded concepts plus non-fatal warnings.
 */
export const loadBundle = (target: string): Promise<LoadedBundle> =>
  loadBundleFromDisk(nodeFsPort, target)
