/**
 * Real-stdio smoke test: spawns the built `dks-mcp` entrypoint and drives it
 * with the official SDK client over an actual child-process transport.
 *
 * `contract.test.ts` proves the handlers over `InMemoryTransport`, so it cannot
 * see the parts this file exists for: argument parsing, the fail-closed exit
 * codes, and the fact that `dist/cli.js` really speaks MCP on the process's own
 * stdin/stdout. A packager, shebang or transport regression leaves the
 * in-memory suite green, which is exactly how an adapter ships broken.
 *
 * The package is compiled first (incremental, ~1s) so the test always drives
 * the current source instead of whatever `dist/` happened to contain.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Package root: this file lives in `src/`. */
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** The entrypoint `package.json` publishes as the `dks-mcp` binary. */
const CLI_ENTRY = join(PACKAGE_DIR, 'dist', 'cli.js')
/** A cold compile of this package plus a real process handshake. */
const BUILD_TIMEOUT_MS = 60_000
/** Ceiling for one served call; a local read-only server needs milliseconds. */
const CALL_TIMEOUT_MS = 20_000
/** CLI usage line, asserted verbatim so a silent reword fails a check. */
const USAGE_PREFIX = 'Usage: dks-mcp serve BUNDLE'
/** Prefix on every fail-closed message the CLI writes to stderr. */
const ERROR_PREFIX = 'dks-mcp:'

/** Minimal valid index file (OKF v0.2). */
const INDEX = `---\nokf_version: '0.2'\n---\n\n# Index\n`
/** Reserved log file, ignored by the loader. */
const LOG = `# Log\n`
/** One concept, enough to prove a served result carries bundle data. */
const ALPHA = `---\ntype: Project\ntitle: Alpha Project\ntags:\n  - research\n---\n\nAlpha body.\n`

/** Bundle directory shared by every test in this file. */
let bundleDir = ''

beforeAll(() => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
  try {
    execFileSync(process.execPath, [tsc, '-p', join(PACKAGE_DIR, 'tsconfig.json')], {
      cwd: PACKAGE_DIR,
      stdio: 'pipe',
    })
  } catch (err) {
    // `stdio: 'pipe'` hides tsc's own report; without this a type error in the
    // package surfaces as a bare "Command failed" with no diagnostic at all.
    const stderr = (err as { stderr?: string | Buffer }).stderr
    const detail = stderr === undefined ? '' : String(stderr).trim()
    throw new Error(`dks-mcp build failed before the smoke test could run:\n${detail}`)
  }
  bundleDir = mkdtempSync(join(tmpdir(), 'dks-mcp-stdio-'))
  mkdirSync(join(bundleDir, 'concepts'))
  writeFileSync(join(bundleDir, 'index.md'), INDEX)
  writeFileSync(join(bundleDir, 'log.md'), LOG)
  writeFileSync(join(bundleDir, 'concepts', 'alpha.md'), ALPHA)
}, BUILD_TIMEOUT_MS)

afterAll(() => {
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true })
})

/** Spawns the built CLI over a real child-process stdio transport. */
const connectOverStdio = async (): Promise<Client> => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI_ENTRY, 'serve', bundleDir],
    stderr: 'pipe',
  })
  const client = new Client({ name: 'stdio-smoke', version: '0.0.0' })
  await client.connect(transport)
  return client
}

/** Runs the built CLI without an MCP handshake and captures its output. */
const runCli = (...args: string[]) =>
  spawnSync(process.execPath, [CLI_ENTRY, ...args], { encoding: 'utf8' as const })

/** Parses the single JSON text payload of a tool result. */
const payloadOf = (result: unknown): Record<string, unknown> => {
  const content = (result as { content: Array<{ text: string }> }).content
  return JSON.parse(content[0]?.text ?? '{}') as Record<string, unknown>
}

describe('dks-mcp over a spawned stdio process', () => {
  it('handshakes, lists the read-only tools, and serves a bundle result', async () => {
    const client = await connectOverStdio()
    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        'find_path',
        'get_claims',
        'get_entity',
        'list_tags',
        'neighborhood',
        'search',
      ])

      const search = payloadOf(
        await client.callTool({ name: 'search', arguments: { query: 'Alpha' } }),
      )
      const hits = search.hits as Array<{ name: string }>
      expect(hits).toHaveLength(1)
      expect(hits[0]?.name).toBe('Alpha Project')
    } finally {
      await client.close()
    }
  }, CALL_TIMEOUT_MS)

  it('exits 2 with the usage line when the command or bundle is missing', () => {
    const result = runCli()
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(USAGE_PREFIX)
  })

  it('exits 1 without serving when the bundle cannot be read', () => {
    const result = runCli('serve', join(bundleDir, 'missing'))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(ERROR_PREFIX)
    expect(result.stdout).toBe('')
  })
})
