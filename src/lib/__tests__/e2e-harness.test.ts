import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

/**
 * Contract tests for the E2E harness (plans/153).
 *
 * Both halves of this file exist because of one real failure: a PR run on
 * 2026-09-24 started 149 tests against a `next dev` server that had bound its port
 * but could not serve yet, 140 of them failed, and the run left **no evidence** —
 * the workflow uploaded a `playwright-report/` directory that the `list` reporter
 * never creates, while the traces in `test-results/` were never uploaded. These
 * tests pin the two properties that made it undiagnosable.
 */

/** Load `playwright.config.ts` with `CI` set, since the reporter depends on it. */
const loadConfig = async (ci: boolean): Promise<PlaywrightConfig> => {
  vi.resetModules()
  vi.stubEnv('CI', ci ? 'true' : '')
  const loaded = (await import('../../../playwright.config')) as { default: PlaywrightConfig }
  return loaded.default
}

interface PlaywrightConfig {
  reporter: unknown
  webServer: {
    command: string
    url?: string
    port?: number
    timeout?: number
    reuseExistingServer?: boolean
    stdout?: string
    stderr?: string
  }
}

const loadWorkflow = () => {
  const path = join(process.cwd(), '.github/workflows', 'ci-and-labels.yml')
  return parse(readFileSync(path, 'utf-8'))
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Playwright web server readiness', () => {
  it('waits for a served response, not a bound port', async () => {
    const config = await loadConfig(false)

    // `port` is satisfied the moment `next dev` binds, while it is still
    // compiling — which is how 149 tests started against a server that could not
    // answer. `url` waits for an actual HTTP response.
    expect(config.webServer.url).toBe('http://localhost:3000')
    expect(config.webServer.port).toBeUndefined()
    expect(config.webServer.timeout).toBeGreaterThan(60000)
  })

  it('pipes the dev server output into the job log', async () => {
    const config = await loadConfig(false)

    // Without this the server is invisible in CI, so a stall cannot be told apart
    // from a broken test.
    expect(config.webServer.stdout).toBe('pipe')
    expect(config.webServer.stderr).toBe('pipe')
  })

  it('keeps the local server reuse so a running dev server is not restarted', async () => {
    const config = await loadConfig(false)
    expect(config.webServer.reuseExistingServer).toBe(true)
  })
})

describe('Playwright reporters', () => {
  it('writes the HTML report in CI, where the workflow uploads it', async () => {
    const config = await loadConfig(true)

    expect(JSON.stringify(config.reporter)).toContain('html')
  })

  it('keeps the console list reporter locally', async () => {
    const config = await loadConfig(false)

    expect(config.reporter).toBe('list')
  })
})

describe('E2E failure artifacts', () => {
  it('uploads the traces alongside the report', () => {
    const workflow = loadWorkflow()
    const steps = workflow.jobs['e2e-tests'].steps as Array<{
      name?: string
      if?: string
      with?: { name?: string; path?: string; 'if-no-files-found'?: string }
    }>
    const upload = steps.find((step) => step.name === 'Upload Playwright artifacts')
    expect(upload).toBeDefined()

    // `trace: 'on-first-retry'` writes into test-results/, which no upload step
    // covered: the report path is created by the html reporter only.
    expect(upload?.if).toBe('failure()')
    const paths = (upload?.with?.path ?? '').split('\n').map((line) => line.trim())
    expect(paths).toContain('playwright-report/')
    expect(paths).toContain('test-results/')

    // A missing directory is worth a warning, not silence.
    expect(upload?.with?.['if-no-files-found']).toBe('warn')
  })
})
