import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCli } from './cli.js'
import { COMMAND_DOCS } from './commands/help.js'
import { CLI_VERSION } from './version.js'
import { SEED_GRAPH_PERF_ID, seedBundle, withTempDir, writeBackupArchive, writeSkill } from './fixtures.test.helpers.js'

const noEnv: ReadonlyMap<string, string> = new Map()
const envWith = (bundle: string): ReadonlyMap<string, string> => new Map([['DKS_BUNDLE', bundle]])
const noStdin = async (): Promise<string> => {
  throw new Error('stdin was not expected in this test')
}

const runJson = async (argv: string[], env: ReadonlyMap<string, string> = noEnv): Promise<{ code: number; envelope: Record<string, unknown> }> => {
  // Tests that just want the envelope get it even when they omit --format.
  const forced = argv.includes('--format') ? argv : ['--format', 'json', ...argv]
  const result = await runCli(forced, { env, stdin: noStdin })
  return { code: result.exitCode, envelope: JSON.parse(result.stdout) as Record<string, unknown> }
}

describe('runCli — envelope contract', () => {
  it('help prints text and exits 0', async () => {
    const result = await runCli(['help'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('dks — read-only OKF bundle operator CLI')
    expect(result.stderr).toBe('')
  })

  it('bare dks behaves like help', async () => {
    const result = await runCli([], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('dks help [COMMAND]')
  })

  it('-h is an alias of help', async () => {
    const result = await runCli(['-h'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('commands:')
  })

  it('help --format json prints the inventory as a JSON envelope', async () => {
    const { code, envelope } = await runJson(['--format', 'json', 'help'])
    expect(code).toBe(0)
    expect(envelope.ok).toBe(true)
    const data = envelope.data as { commands: unknown[]; flags: { flag: string }[] }
    expect(data.commands.length).toBeGreaterThanOrEqual(10)
    expect(data.flags.map((flag) => flag.flag)).toContain('--quiet')
  })

  it('version reports name/version/node in text and JSON', async () => {
    const text = await runCli(['version'], { env: noEnv, stdin: noStdin })
    expect(text.exitCode).toBe(0)
    expect(text.stdout).toContain(`dks-cli ${CLI_VERSION}`)

    const { envelope } = await runJson(['version', '--format', 'json'])
    expect(envelope.meta).toEqual({ command: 'version', version: CLI_VERSION })
    expect(envelope.data).toMatchObject({ version: CLI_VERSION, name: 'dks-cli' })
  })

  it('unknown commands exit 2 with a nearest-command hint', async () => {
    const { code, envelope } = await runJson(['searchy'])
    expect(code).toBe(2)
    expect(envelope.ok).toBe(false)
    const error = envelope.error as { code: string; message: string; hint?: string }
    expect(error.code).toBe('usage')
    expect(error.message).toContain('unknown command "searchy"')
    expect(error.hint).toContain('search')
  })

  it('text-mode failures are diagnostics on stderr only', async () => {
    const result = await runCli(['--bundle', './no-such-bundle', 'doctor'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(3)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('dks doctor: bundle not found at "./no-such-bundle"')
    expect(result.stderr).toContain('hint:')
  })

  it('json-mode failures print the failure envelope to stdout', async () => {
    const { code, envelope } = await runJson(['--bundle', './missing-thing', 'doctor'])
    expect(code).toBe(3)
    expect(envelope.ok).toBe(false)
    expect((envelope.error as { code: string }).code).toBe('not_found')
  })

  it('keeps the JSON envelope when argument parsing itself fails', async () => {
    const result = await runCli(['--format', 'json', '--limit', 'abc', 'search', 'x'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toBe('')
    const envelope = JSON.parse(result.stdout) as { ok: boolean; error: { code: string } }
    expect(envelope.ok).toBe(false)
    expect(envelope.error.code).toBe('usage')
  })

  it('shows the preceding command\'s help for cmd <operand> --help', async () => {
    const result = await runCli(['search', 'graph', '--help'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('usage:\n  dks search QUERY...')
    expect(result.stdout).toContain('examples:')
    expect(result.stdout).toContain('dks search knowledge graph')
    expect(result.stderr).toBe('')
  })

  it('dks help <command> prints usage, access and examples for that command only', async () => {
    const result = await runCli(['help', 'entity'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('usage:\n  dks entity ID')
    expect(result.stdout).toContain('access: read-only')
    expect(result.stdout).toContain('dks entity <id> --format json')
    expect(result.stdout).not.toContain('BM25 retrieval')
    expect(result.stderr).toBe('')
  })

  it('help <command> --format json narrows the payload to one command', async () => {
    const { code, envelope } = await runJson(['help', 'graph'])
    expect(code).toBe(0)
    const data = envelope.data as {
      focused?: string
      commands: { name: string; usage: string; access: string; examples: string[] }[]
    }
    expect(data.focused).toBe('graph')
    expect(data.commands).toHaveLength(1)
    expect(data.commands[0]).toMatchObject({ name: 'graph', access: 'read-only' })
    expect(data.commands[0]?.examples.length).toBeGreaterThanOrEqual(2)
  })

  it('rejects an unknown help target with a nearest hint', async () => {
    const { code, envelope } = await runJson(['help', 'serch'])
    expect(code).toBe(2)
    expect((envelope.error as { hint?: string }).hint).toContain('search')
  })

  it('documents usage, read-only access and examples for every command', () => {
    for (const doc of COMMAND_DOCS) {
      expect(doc.usage.length, doc.name).toBeGreaterThan(0)
      expect(doc.access, doc.name).toBe('read-only')
      expect(doc.examples.length, doc.name).toBeGreaterThanOrEqual(1)
      for (const example of doc.examples) expect(example, doc.name).toContain(`dks ${doc.name}`)
    }
  })

  it('does not resolve a malformed DKS_BUNDLE for commands that need none', async () => {
    const env = new Map([['DKS_BUNDLE', 'bad\\path']])
    const result = await runCli(['version'], { env, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('dks-cli')
  })

  it('keeps --passphrase-env values out of JSON diagnostics', async () => {
    const result = await runCli(
      ['--format', 'json', 'backup', 'verify', '--passphrase-env', 'hunter2', 'archive.dksb'],
      { env: noEnv, stdin: noStdin },
    )
    expect(result.exitCode).toBe(2)
    expect(result.stdout).not.toContain('hunter2')
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'usage' } })
  })

  it('keeps surplus positional secrets out of JSON diagnostics', async () => {
    const result = await runCli(
      ['--format', 'json', 'backup', 'verify', 'archive.dksb', 'hunter2'],
      { env: noEnv, stdin: noStdin },
    )
    expect(result.exitCode).toBe(2)
    expect(result.stdout).not.toContain('hunter2')
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'usage' } })
  })

  it('--quiet suppresses stdout on success but keeps the exit code', async () => {
    const result = await runCli(['version', '--quiet'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('--verbose writes one diagnostic line to stderr and leaves stdout untouched', async () => {
    const text = await runCli(['--verbose', 'version'], { env: noEnv, stdin: noStdin })
    expect(text.exitCode).toBe(0)
    expect(text.stdout).toContain('dks-cli')
    expect(text.stderr.split('\n')).toHaveLength(1)
    expect(text.stderr).toContain('dks verbose: command=version')
    expect(text.stderr).toContain('bundle=')

    const json = await runCli(['--verbose', '--format', 'json', 'version'], { env: noEnv, stdin: noStdin })
    expect(json.exitCode).toBe(0)
    expect(() => JSON.parse(json.stdout)).not.toThrow()
    expect(json.stderr).toContain('format=json')
  })

  it('--verbose diagnostics accompany failures without changing the exit code', async () => {
    const result = await runCli(['--verbose', '--bundle', './no-such-bundle', 'doctor'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(3)
    expect(result.stderr).toContain('dks verbose: command=doctor')
    expect(result.stderr).toContain('dks doctor: bundle not found')
  })

  it('--verbose still reports when argument parsing itself fails', async () => {
    const result = await runCli(['--verbose', '--format', 'yaml', 'doctor'], { env: noEnv, stdin: noStdin })
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('dks verbose:')
    expect(result.stderr).toContain('arguments could not be fully parsed')
  })

  it('--limit clamps into the 1–200 window', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      const { envelope } = await runJson(['--bundle', bundle, 'index', '--limit', '999'])
      const data = envelope.data as { shown: number; total: number }
      expect(data.shown).toBe(Math.min(data.total, 200))
      expect(envelope.ok).toBe(true)
    })
  })
})

describe('runCli — corpus commands end to end', () => {
  it('doctor, search, and entity run against a real bundle', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      const { envelope: doctor } = await runJson(['--bundle', bundle, 'doctor'])
      expect((doctor.data as { healthy: boolean }).healthy).toBe(true)

      const { envelope: search } = await runJson(['--bundle', bundle, 'search', 'rendering'])
      const results = (search.data as { results: { id: string; score: number }[] }).results
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.every((hit) => typeof hit.score === 'number' && !Number.isNaN(hit.score))).toBe(true)

      const { envelope: entity } = await runJson(['--bundle', bundle, 'entity', SEED_GRAPH_PERF_ID])
      expect((entity.data as { name: string }).name).toBe('Graph performance')
    })
  })

  it('graph path between linked entities succeeds; disconnected details exit 3', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      const { code, envelope } = await runJson(['--bundle', bundle, 'graph', 'path', SEED_GRAPH_PERF_ID, 'notes/backups'])
      expect(code).toBe(0)
      expect((envelope.data as { hops: unknown[] }).hops).toHaveLength(1)

      const { code: missingCode } = await runJson(['--bundle', bundle, 'graph', 'path', SEED_GRAPH_PERF_ID, 'notes/ghost'])
      expect(missingCode).toBe(3)
    })
  })

  it('export renders markdown in text mode and bundle JSON in json mode', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      const md = await runCli(['--bundle', bundle, 'export'], { env: noEnv, stdin: noStdin })
      expect(md.exitCode).toBe(0)
      expect(md.stdout).toContain('title: Graph performance')

      const { envelope } = await runJson(['--bundle', bundle, 'export', '--format', 'json'])
      const data = envelope.data as { okfVersion: string; files: { path: string }[] }
      expect(data.okfVersion).toBe('0.2')
      expect(data.files.some((file) => file.path.includes('graph-perf'))).toBe(true)
    })
  })

  it('skills test reports healthy skills with mapped exits', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      await writeSkill(bundle, 'sample')
      const { code, envelope } = await runJson(['--bundle', bundle, 'skills', 'test'])
      expect(code).toBe(0)
      expect((envelope.data as { failed: number }).failed).toBe(0)
    })
  })

  it('backup verify reports success and not-found with mapped exits', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      const ok = await runCli(['backup', 'verify', fixture.path], { env: noEnv, stdin: noStdin })
      expect(ok.exitCode).toBe(0)
      expect(ok.stdout).toContain('verified: yes')

      const { code } = await runJson(['backup', 'verify', join(dir, 'missing.dksb')])
      expect(code).toBe(3)
    })
  })
})

describe('runCli — stdin placeholder', () => {
  it('backup verify - consumes the piped archive through the injected reader', async () => {
    await withTempDir(async (dir) => {
      const fixture = await writeBackupArchive(dir)
      const stdin = async (): Promise<string> => readFile(fixture.path, 'utf8')
      const result = await runCli(['--format', 'json', 'backup', 'verify', '-'], { env: noEnv, stdin })
      expect(result.exitCode).toBe(0)
      const envelope = JSON.parse(result.stdout) as Record<string, unknown>
      expect((envelope.data as { archive: string }).archive).toBe('-')
    })
  })

  it('a failing piped stdin surfaces as io', async () => {
    const result = await runCli(['backup', 'verify', '-'], {
      env: noEnv,
      stdin: async () => {
        throw new Error('pipe broken')
      },
    })
    expect(result.exitCode).toBe(5)
  })
})

describe('runCli — DKS_BUNDLE environment default', () => {
  it('resolves DKS_BUNDLE when no --bundle flag is given', async () => {
    await withTempDir(async (dir) => {
      const bundle = await seedBundle(dir)
      const { envelope } = await runJson(['doctor'], envWith(bundle))
      expect(envelope.ok).toBe(true)
      expect(((envelope.data as { bundle: { path: string } }).bundle).path).toBe(bundle)
    })
  })
})
