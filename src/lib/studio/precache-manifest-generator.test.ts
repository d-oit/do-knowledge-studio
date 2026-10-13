import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * The generator is a build script that derives its paths from its own location,
 * so each case runs a copy of it against a fixture repository — `<tmp>/scripts/`
 * plus the `.next` tree that case needs. That exercises the real exit codes and
 * the real written manifest instead of a reimplementation of either.
 *
 * The layout under test is the one Vercel produced: a build that completed
 * without leaving `.next/server/app/index.html` behind must still get a manifest
 * (plans/166), while a build missing its inventories must still be refused.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..')
const SCRIPT_RELATIVE = join('scripts', 'generate-precache-manifest.mjs')

const DOCUMENT_HTML = [
  '<html><head>',
  '<link rel="stylesheet" href="/_next/static/chunks/app.css">',
  '<link rel="stylesheet" href="/_next/static/css/legacy.css">',
  '</head><body>',
  '<script src="/_next/static/chunks/main-app.js"></script>',
  '</body></html>',
].join('')

const write = (root: string, relative: string, content = ''): void => {
  const absolute = join(root, relative)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

interface FixtureOptions {
  /** Emit `.next/server/app/index.html`, as a local `pnpm run build` does. */
  document?: boolean
  /** Emit `.next/static/chunks` at all. */
  chunks?: boolean
  /** Emit a JavaScript chunk inside the inventory (the app's lazy views need one). */
  javascriptChunk?: boolean
  /** Emit `.next/static/media` at all. */
  media?: boolean
}

const makeFixture = (options: FixtureOptions = {}): string => {
  const {
    document: withDocument = true,
    chunks: withChunks = true,
    javascriptChunk = true,
    media: withMedia = true,
  } = options
  const root = mkdtempSync(join(tmpdir(), 'precache-fixture-'))
  cpSync(join(REPO_ROOT, SCRIPT_RELATIVE), join(root, SCRIPT_RELATIVE))
  mkdirSync(join(root, 'public'), { recursive: true })
  if (withDocument) write(root, join('.next', 'server', 'app', 'index.html'), DOCUMENT_HTML)
  if (withChunks) {
    if (javascriptChunk) write(root, join('.next', 'static', 'chunks', 'main-app.js'), '// chunk')
    write(root, join('.next', 'static', 'chunks', 'app.css'), '/* css */')
  }
  if (withMedia) write(root, join('.next', 'static', 'media', 'newsreader.woff2'), 'font')
  return root
}

/** Runs the script in its fixture and reports the exit status plus both streams. */
const runScript = (root: string): { status: number; output: string } => {
  try {
    const stdout = execFileSync('node', [join(root, SCRIPT_RELATIVE)], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, output: stdout }
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string }
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` }
  }
}

const readManifest = (root: string): string[] => {
  const raw = readFileSync(join(root, 'public', 'precache-manifest.json'), 'utf8')
  return (JSON.parse(raw) as { urls: string[] }).urls
}

describe('generate-precache-manifest', () => {
  const roots: string[] = []
  const fixture = (options?: FixtureOptions): string => {
    const root = makeFixture(options)
    roots.push(root)
    return root
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  it('lists the document assets, every chunk, and every media file', () => {
    const root = fixture()
    const result = runScript(root)

    expect(result.status).toBe(0)
    const urls = readManifest(root)
    // Document-only asset: referenced by the HTML, outside the chunk inventory.
    expect(urls).toContain('/_next/static/css/legacy.css')
    expect(urls).toContain('/_next/static/chunks/main-app.js')
    expect(urls).toContain('/_next/static/chunks/app.css')
    expect(urls).toContain('/_next/static/media/newsreader.woff2')
    expect(urls).toContain('/')
  })

  it('still writes the inventory when the build left no boot document', () => {
    const root = fixture({ document: false })
    const result = runScript(root)

    expect(result.status).toBe(0)
    const urls = readManifest(root)
    expect(urls).toContain('/_next/static/chunks/main-app.js')
    expect(urls).toContain('/_next/static/chunks/app.css')
    expect(urls).toContain('/_next/static/media/newsreader.woff2')
    expect(result.output).toContain('index.html')
  })

  it('refuses to write a manifest when the chunk inventory is missing', () => {
    const root = fixture({ chunks: false })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toMatch(/incomplete/)
    expect(existsSync(join(root, 'public', 'precache-manifest.json'))).toBe(false)
  })

  it('refuses to write a manifest with no JavaScript chunks', () => {
    const root = fixture({ javascriptChunk: false })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toMatch(/Refusing to/)
    expect(existsSync(join(root, 'public', 'precache-manifest.json'))).toBe(false)
  })
})
