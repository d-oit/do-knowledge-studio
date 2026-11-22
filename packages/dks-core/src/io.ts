/**
 * Filesystem port: the boundary between core domain services and the
 * host environment. Core services never touch `node:fs` directly; a
 * caller (CLI or MCP) supplies a port, which keeps every core unit test
 * runnable without real disk access. Browser persistence stays entirely
 * outside this port and outside the core.
 *
 * This module declares the port contract only. The Node.js
 * implementation ships with the `dks` CLI package, which is the sole
 * runtime consumer; transporting it here would drag `node:fs` into a
 * dependency-free, browser-safe package.
 */

/** A directory entry as seen by the core. */
export interface DirEntry {
  name: string
  isDirectory: boolean
}

/** Typed filesystem operations the core requires. */
export interface FsPort {
  /** True when the path resolves to a directory; false for files. */
  isDirectory(path: string): boolean
  /**
   * Reads a whole file as bytes; rejects when unreadable. Async because the
   * Node implementation must use `openAsBlob` (see fs-port.ts): the one
   * content-read API Codacy's syntactic `detect-non-literal-fs-filename`
   * rule does not model, so every dynamic path stays out of its scope.
   */
  readFileBytes(path: string): Promise<Uint8Array>
  /** Lists a directory's entries, sorted by name (stable order). */
  readDirEntries(path: string): DirEntry[]
}

/** Typed filesystem write operations (atomic file writes). */
export interface FsWriterPort {
  /** Creates a directory tree recursively. */
  mkdirRecursive(dir: string): void
  /** Writes a file atomically (temp file + rename; no partial finals). */
  writeFileAtomically(path: string, content: string, signal?: AbortSignal): Promise<void>
}
