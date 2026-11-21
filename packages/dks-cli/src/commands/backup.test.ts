import { describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PASSPHRASE_FLAG, backupVerifyData } from './backup.js'
import { nodeFsPort } from '../fs-port.js'
import { tamperBackupArchive, withTempDir, writeBackupArchive, writeEncryptedBackupArchive } from '../fixtures.js'
import { CliError } from '../errors.js'

const envWith = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries))
const noStdin = async (): Promise<string> => {
  throw new Error('stdin should not be read for path archives')
}

describe('backupVerifyData — ok', () => {
  it('verifies a well-formed unencrypted archive', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      const data = await backupVerifyData([fixture.path], { port: nodeFsPort, env: new Map(), stdin: noStdin })
      expect(data.verified).toBe(true)
      expect(data.archive).toBe(fixture.path)
      expect(data.summary.encrypted).toBe(false)
      expect(data.summary.entityCount).toBe(1)
      expect(data.summary.claimCount).toBe(1)
      expect(data.summary.tagCount).toBe(1)
      expect(data.summary.graphViewCount).toBe(0)
    })
  })

  it('reads the archive from stdin with the - placeholder', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      let stdinReads = 0
      const data = await backupVerifyData(['-'], {
        port: nodeFsPort,
        env: new Map(),
        stdin: async () => {
          stdinReads += 1
          return readFile(fixture.path, 'utf8')
        },
      })
      expect(stdinReads).toBe(1)
      expect(data.archive).toBe('-')
      expect(data.verified).toBe(true)
    })
  })
})

describe('backupVerifyData — tamper / io', () => {
  it('maps tampered payloads to a conflict', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      await tamperBackupArchive(fixture)
      try {
        await backupVerifyData([fixture.path], { port: nodeFsPort, env: new Map(), stdin: noStdin })
        expect.unreachable('expected verification to fail')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        const cliError = err as CliError
        expect(cliError.code).toBe('conflict')
        expect(cliError.message).toContain('checksum')
      }
    })
  })

  it('maps a missing archive to not_found', async () => {
    await withTempDir(async (dir) => {
      await expect(backupVerifyData([join(dir, 'missing.dksb')], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
        .rejects.toMatchObject({ code: 'not_found' })
    })
  })

  it('maps non-JSON archives to io', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, 'garbage.dksb')
      await writeFile(path, 'not json at all', 'utf8')
      await expect(backupVerifyData([path], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
        .rejects.toMatchObject({ code: 'io' })
    })
  })
})

describe('backupVerifyData — passphrase handling (#1171)', () => {
  it('maps passphrase-required to permission', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeEncryptedBackupArchive(dir)
      try {
        await backupVerifyData([fixture.path], { port: nodeFsPort, env: new Map(), stdin: noStdin })
        expect.unreachable('expected passphrase-required failure')
      } catch (err) {
        expect((err as CliError).code).toBe('permission')
        expect((err as CliError).message).toContain('passphrase-required')
      }
    })
  })

  it('maps decrypt-failed (wrong passphrase from env) to permission', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeEncryptedBackupArchive(dir)
      try {
        await backupVerifyData([fixture.path, PASSPHRASE_FLAG, 'WRONG_ENV'], {
          port: nodeFsPort,
          env: envWith({ WRONG_ENV: 'hunter2' }),
          stdin: noStdin,
        })
        expect.unreachable('expected decrypt failure')
      } catch (err) {
        expect((err as CliError).code).toBe('permission')
        expect((err as CliError).message).toContain('decrypt-failed')
      }
    })
  })

  it('rejects an unset --passphrase-env variable as usage', async () => {
    await withTempDir(async () => {
      await expect(backupVerifyData(['archive.dksb', PASSPHRASE_FLAG, 'MISSING_VAR'], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
        .rejects.toMatchObject({ code: 'usage' })
    })
  })

  it('refuses passphrase argv outright (any --passphrase token)', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      await expect(backupVerifyData([fixture.path, '--passphrase', 'hunter2'], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
        .rejects.toMatchObject({ code: 'usage' })
      await expect(backupVerifyData([fixture.path, '--passphrase=hunter2'], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
        .rejects.toMatchObject({ code: 'usage' })
    })
  })

  it('requires an archive path', async () => {
    await expect(backupVerifyData([], { port: nodeFsPort, env: new Map(), stdin: noStdin }))
      .rejects.toMatchObject({ code: 'usage' })
  })

  it('passes a set env passphrase through to decryption', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeEncryptedBackupArchive(dir)
      await expect(backupVerifyData([fixture.path, PASSPHRASE_FLAG, 'CORRECT_ENV'], {
        port: nodeFsPort,
        env: envWith({ CORRECT_ENV: 'nope' }),
        stdin: noStdin,
      })).rejects.toMatchObject({ code: 'permission' })
    })
  })
})
