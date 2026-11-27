/**
 * Binary-level end-to-end for `dks` (#1171).
 *
 * `cli.test.ts` calls `runCli` in-process: it proves dispatch and rendering, but
 * not what a user actually runs — `dist/bin.js`, its own argv, the exit code the
 * shell sees, and stdout as the only JSON channel. This file builds the package,
 * exports a bundle through the app's own OKF exporter (`buildOkfBundle`), and
 * spawns the binary against the result, so export → disk → CLI is one path.
 *
 * The bundle is generated rather than checked in: a hand-written fixture would
 * only prove the CLI parses Markdown we wrote for it, and would drift from the
 * exporter silently.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOkfBundle } from 'dks-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Package root: this file lives in `src/`. */
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** The entrypoint `package.json` publishes as the `dks` binary. */
const BIN_ENTRY = join(PACKAGE_DIR, 'dist', 'bin.js')
/** A cold compile of this package plus two process launches. */
const BUILD_TIMEOUT_MS = 60_000
/** One CLI process reads a two-concept bundle; it needs milliseconds. */
const CALL_TIMEOUT_MS = 20_000
/** Fixed export timestamp so the generated bundle is reproducible. */
const EXPORT_TIME = new Date('2026-11-27T00:00:00.000Z')

/** Envelope success shape from `src/envelope.ts`. */
interface SuccessEnvelope<T> {
  ok: true
  data: T
  meta: { command: string; version: string }
}

/** Envelope failure shape from `src/envelope.ts`. */
interface FailureEnvelope {
  ok: false
  error: { code: string; message: string; hint?: string }
  meta: { command: string; version: string }
}

/** `dks index --format json` payload. */
interface IndexPayload {
  total: number
  shown: number
  items: Array<{ id: string; name: string }>
}

/** `dks search --format json` payload. */
interface SearchPayload {
  query: string
  limit: number
  results: Array<{ id: string; type: 'entity' | 'claim'; name: string }>
}

/** `dks entity --format json` payload (only the fields asserted here). */
interface EntityPayload {
  id: string
  name: string
  type: string
  tags: string[]
  claims: Array<{ statement: string }>
  related: Array<{ id: string; name: string | null }>
}

/** Bundle directory shared by every test in this file. */
let bundleDir = ''

beforeAll(() => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
  execFileSync(process.execPath, [tsc, '-p', join(PACKAGE_DIR, 'tsconfig.build.json')], {
    cwd: PACKAGE_DIR,
    stdio: 'pipe',
  })

  // The real exporter: the PWA export view calls the same function.
  const bundle = buildOkfBundle(
    [
      {
        id: 'alpha',
        name: 'Alpha Project',
        type: 'project',
        description: 'Graph store',
        content: 'Nodes and edges connect.',
        tags: ['research'],
      },
      {
        id: 'beta',
        name: 'Beta Concept',
        type: 'concept',
        description: '',
        content: 'A graph query planner.',
        tags: [],
      },
    ],
    [
      {
        entityId: 'alpha',
        statement: 'Graphs scale linearly',
        source: 'https://example.com/paper',
        evidence: 'Scale paper',
      },
    ],
    [{ source: 'alpha', target: 'beta' }],
    '0.2.0',
    EXPORT_TIME,
  )

  bundleDir = mkdtempSync(join(tmpdir(), 'dks-cli-e2e-'))
  for (const file of bundle.files) {
    const target = join(bundleDir, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content)
  }
}, BUILD_TIMEOUT_MS)

afterAll(() => {
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true })
})

/** Spawns the published binary and captures its output. */
const runDks = (...args: string[]) =>
  spawnSync(process.execPath, [BIN_ENTRY, ...args], { encoding: 'utf8' as const })

/** Parses whichever envelope the CLI printed. */
const envelopeOf = <T>(stdout: string): SuccessEnvelope<T> | FailureEnvelope =>
  JSON.parse(stdout) as SuccessEnvelope<T> | FailureEnvelope

describe('dks binary against an exported OKF bundle', () => {
  it('indexes the bundle the exporter wrote', () => {
    const result = runDks('index', '--bundle', bundleDir, '--format', 'json')
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')

    const envelope = envelopeOf<IndexPayload>(result.stdout)
    expect(envelope).toMatchObject({ ok: true, meta: { command: 'index' } })
    if (!envelope.ok) throw new Error(envelope.error.message)
    expect(envelope.data.total).toBe(2)
    expect(envelope.data.items.map((item) => item.name).sort()).toEqual([
      'Alpha Project',
      'Beta Concept',
    ])
  }, CALL_TIMEOUT_MS)

  it('finds exported concepts and their claim source through search', () => {
    const result = runDks('search', 'graph', '--bundle', bundleDir, '--format', 'json')
    expect(result.status).toBe(0)

    const envelope = envelopeOf<SearchPayload>(result.stdout)
    if (!envelope.ok) throw new Error(envelope.error.message)
    expect(envelope.data.query).toBe('graph')
    const names = envelope.data.results
      .filter((hit) => hit.type === 'entity')
      .map((hit) => hit.name)
    expect(names).toContain('Alpha Project')
    expect(names).toContain('Beta Concept')
  }, CALL_TIMEOUT_MS)

  it('reads one concept by the id the index printed, with claims and relations', () => {
    const index = envelopeOf<IndexPayload>(
      runDks('index', '--bundle', bundleDir, '--format', 'json').stdout,
    )
    if (!index.ok) throw new Error(index.error.message)
    const alpha = index.data.items.find((item) => item.name === 'Alpha Project')
    const beta = index.data.items.find((item) => item.name === 'Beta Concept')
    expect(alpha).toBeDefined()
    expect(beta).toBeDefined()

    const result = runDks('entity', alpha?.id ?? '', '--bundle', bundleDir, '--format', 'json')
    expect(result.status).toBe(0)

    const envelope = envelopeOf<EntityPayload>(result.stdout)
    if (!envelope.ok) throw new Error(envelope.error.message)
    expect(envelope.data).toMatchObject({ name: 'Alpha Project', tags: ['research'] })
    expect(envelope.data.claims.map((claim) => claim.statement)).toEqual([
      'Graphs scale linearly',
    ])
    // The exporter writes a bundle-relative link and the loader turns it back
    // into the target's own id, so the exported edge round-trips.
    expect(envelope.data.related.map((entry) => entry.id)).toEqual([beta?.id])
  }, CALL_TIMEOUT_MS)

  it('exits 3 with a JSON envelope for an unknown entity id', () => {
    const result = runDks('entity', 'ghost', '--bundle', bundleDir, '--format', 'json')
    expect(result.status).toBe(3)

    const envelope = envelopeOf<EntityPayload>(result.stdout)
    expect(envelope.ok).toBe(false)
    if (envelope.ok) throw new Error('expected a failure envelope')
    expect(envelope.error.code).toBe('entity_not_found')
    expect(envelope.error.hint).toContain('dks index')
  }, CALL_TIMEOUT_MS)

  it('exits 5 when the bundle path does not exist', () => {
    const result = runDks('index', '--bundle', join(bundleDir, 'absent'), '--format', 'json')
    expect(result.status).toBe(5)

    const envelope = envelopeOf<IndexPayload>(result.stdout)
    expect(envelope.ok).toBe(false)
    if (envelope.ok) throw new Error('expected a failure envelope')
    expect(envelope.error.code).toBe('io')
  }, CALL_TIMEOUT_MS)
})
