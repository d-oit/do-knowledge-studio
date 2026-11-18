/**
 * Filesystem port: the boundary between core domain services and the
 * Node.js environment. Core services never touch `node:fs` directly; a
 * caller (CLI or MCP) supplies a port, which keeps every core unit test
 * runnable without real disk access. Browser persistence stays entirely
 * outside this port and outside the core.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises'
import { dirname } from 'node:path'


/** A directory entry as seen by the core. */
export interface DirEntry {
  name: string
  isDirectory: boolean
}

/** Typed filesystem operations the core requires. */
export interface FsPort {
  /** True when the path resolves to a directory; false for files. */
  isDirectory(path: string): boolean
  /** Reads a whole file as bytes; throws when unreadable. */
  readFileBytes(path: string): Uint8Array
  /** Lists a directory's entries, sorted by name (stable order). */
  readDirEntries(path: string): DirEntry[]
}

/** Node.js implementation of {@link FsPort}. */
export const nodeFsPort: FsPort = {
  isDirectory(path) {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  },
  readFileBytes(path) {
    return readFileSync(path)
  },
  readDirEntries(path) {
    return readdirSync(path, { withFileTypes: true })
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
}

/** Typed filesystem write operations (atomic file writes). */
export interface FsWriterPort {
  /** Creates a directory tree recursively. */
  mkdirRecursive(dir: string): void
  /** Writes a file atomically (temp file + rename; no partial finals). */
  writeFileAtomically(path: string, content: string, signal?: AbortSignal): Promise<void>
}

/** Node.js implementation of {@link FsWriterPort}. */
export const nodeFsWriterPort: FsWriterPort = {
  mkdirRecursive(dir) {
    mkdirSync(dir, { recursive: true })
  },
  async writeFileAtomically(path, content, signal) {
    await mkdir(dirname(path), { recursive: true })
    const tempPath = `${path}.${randomUUID()}.dks-tmp`
    let created = false
    let handle: FileHandle | undefined
    try {
      handle = await open(tempPath, 'wx')
      created = true
      await handle.writeFile(content, { encoding: 'utf8', signal })
      await handle.close()
      handle = undefined
      if (signal?.aborted) {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        throw error
      }
      await rename(tempPath, path)
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined)
      if (created) await unlink(tempPath).catch(() => undefined)
      throw error
    }
  },
}
