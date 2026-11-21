import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nodeFsPort, fsErrorCode, validateBundlePath } from './fs-port.js'
import { withTempDir } from './fixtures.js'
import { CliError } from './errors.js'

describe('validateBundlePath', () => {
  it('accepts plain POSIX paths', () => {
    expect(validateBundlePath('./knowledge')).toBe('./knowledge')
  })

  it('rejects empty paths as usage', () => {
    expect(() => validateBundlePath('')).toThrowError(CliError)
    expect(() => validateBundlePath('')).toThrowError(/empty/)
  })

  it('rejects NUL bytes as usage', () => {
    expect(() => validateBundlePath('bad\0path')).toThrowError(/NUL/)
  })

  it('rejects backslash (Windows-style) paths as usage', () => {
    expect(() => validateBundlePath('C:\\knowledge')).toThrowError(/backslash/)
    expect(() => validateBundlePath('a\\b')).toThrowError(CliError)
  })
})

describe('nodeFsPort via tmpdir', () => {
  it('isDirectory is true for directories', async () => {
    await withTempDir(async (dir) => {
      expect(nodeFsPort.isDirectory(dir)).toBe(true)
    })
  })

  it('isDirectory is false for files', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'f.md')
      await writeFile(file, 'x', 'utf8')
      expect(nodeFsPort.isDirectory(file)).toBe(false)
    })
  })

  it('isDirectory is false for missing paths', async () => {
    await withTempDir(async (dir) => {
      expect(nodeFsPort.isDirectory(join(dir, 'missing'))).toBe(false)
    })
  })

  it('readDirEntries lists entries sorted by name', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'b.md'), 'b', 'utf8')
      await writeFile(join(dir, 'a.md'), 'a', 'utf8')
      await mkdir(join(dir, 'sub'))
      const entries = nodeFsPort.readDirEntries(dir)
      expect(entries.map((entry) => entry.name)).toEqual(['a.md', 'b.md', 'sub'])
    })
  })

  it('readDirEntries walks nested trees traversal-safely', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, 'nest', 'deep'), { recursive: true })
      await writeFile(join(dir, 'nest', 'n.md'), 'n', 'utf8')
      await writeFile(join(dir, 'nest', 'deep', 'd.md'), 'd', 'utf8')
      const entries = nodeFsPort.readDirEntries(dir)
      expect(entries.length).toBe(1)
      const nested = nodeFsPort.readDirEntries(join(dir, 'nest'))
      expect(nested.map((entry) => entry.name)).toEqual(['deep', 'n.md'])
    })
  })

  it('refuses to follow symlinks (file or directory)', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'real.md'), 'real', 'utf8')
      await mkdir(join(dir, 'realdir'))
      await symlink(join(dir, 'real.md'), join(dir, 'link-file.md'))
      await symlink(join(dir, 'realdir'), join(dir, 'link-dir'))
      const names = nodeFsPort.readDirEntries(dir).map((entry) => entry.name)
      expect(names).toEqual(['real.md', 'realdir'])
    })
  })

  it('readFileBytes round-trips bytes', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'bin.dat')
      await writeFile(file, new Uint8Array([104, 105, 0, 255]))
      expect([...nodeFsPort.readFileBytes(file)]).toEqual([104, 105, 0, 255])
    })
  })

  it('readFileBytes throws for missing files with errno detail', async () => {
    await withTempDir(async (dir) => {
      const missing = join(dir, 'missing.md')
      expect(() => nodeFsPort.readFileBytes(missing)).toThrowError()
      try {
        nodeFsPort.readFileBytes(missing)
      } catch (err) {
        expect(fsErrorCode(err)).toBe('not_found')
      }
    })
  })
})

describe('fsErrorCode', () => {
  it('maps ENOENT/ENOTDIR to not_found', () => {
    expect(fsErrorCode({ code: 'ENOENT' })).toBe('not_found')
    expect(fsErrorCode({ code: 'ENOTDIR' })).toBe('not_found')
  })

  it('maps EACCES/EPERM to permission', () => {
    expect(fsErrorCode({ code: 'EACCES' })).toBe('permission')
    expect(fsErrorCode({ code: 'EPERM' })).toBe('permission')
  })

  it('maps anything else to io', () => {
    expect(fsErrorCode({ code: 'EISDIR' })).toBe('io')
    expect(fsErrorCode(new Error('no code'))).toBe('io')
    expect(fsErrorCode('not an error object')).toBe('io')
  })
})

describe('tmpdir fixtures stay consistent with the port', () => {
  it('port reads match direct fs reads', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'same.md')
      await writeFile(file, 'identical', 'utf8')
      expect(new TextDecoder().decode(nodeFsPort.readFileBytes(file))).toBe(
        new TextDecoder().decode(readFileSync(file)),
      )
    })
  })
})
