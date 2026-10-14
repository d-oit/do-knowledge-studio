import { z } from 'zod'
import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..')
const SCRIPT_RELATIVE = join('scripts', 'generate-precache-manifest.mjs')
const PUBLIC_MANIFEST = join('public', 'precache-manifest.json')
const SERVED_MANIFEST = join('.next', 'output', 'static', 'precache-manifest.json')
const STALE_PUBLIC_MANIFEST = `${JSON.stringify({ urls: ['/stale-public'] })}\n`
const STALE_SERVED_MANIFEST = `${JSON.stringify({ urls: ['/stale-served'] })}\n`
const SHELL_URLS = [
  '/',
  '/favicon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
]

type FixtureLayout = 'local' | 'adapter'
type FixtureTree = 'classic' | 'immutable' | 'js-only' | 'manifest-only' | 'empty'

interface FixtureOptions {
  layout?: FixtureLayout
  tree?: FixtureTree
  includeLegacyLocalTree?: boolean
  seedStaleManifests?: boolean
  servedManifestDirectory?: boolean
}

const fixtureRoots: string[] = []

const write = (root: string, relativePath: string, content = ''): void => {
  const absolute = join(root, relativePath)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

const expectedManifestUrls = (staticUrls: readonly string[]): string[] =>
  [...new Set([...SHELL_URLS, ...staticUrls])].sort()

const makeFixture = (options: FixtureOptions = {}): string => {
  const {
    layout = 'local',
    tree = 'classic',
    includeLegacyLocalTree = false,
    seedStaleManifests = false,
    servedManifestDirectory = false,
  } = options
  const root = mkdtempSync(join(tmpdir(), 'precache-fixture-'))
  fixtureRoots.push(root)

  try {
    cpSync(join(REPO_ROOT, SCRIPT_RELATIVE), join(root, SCRIPT_RELATIVE))
    mkdirSync(join(root, 'public'), { recursive: true })

    const outputStaticRoot = join('.next', 'output', 'static')
    const inventoryRoot =
      layout === 'adapter'
        ? join(outputStaticRoot, '_next', 'static')
        : join('.next', 'static')

    if (layout === 'adapter') {
      write(root, join('.next', 'output', 'config.json'), '{}')
    }

    if (tree === 'classic') {
      write(root, join(inventoryRoot, 'chunks', 'app.js'), '// app chunk')
      write(root, join(inventoryRoot, 'chunks', 'nested', 'route.mjs'), '// route chunk')
      write(root, join(inventoryRoot, 'css', 'app.css'), '/* standalone CSS */')
      write(root, join(inventoryRoot, 'css', 'nested', 'page.css'), '/* nested CSS */')
      write(root, join(inventoryRoot, 'media', 'heading.woff2'), 'font')
      write(root, join(inventoryRoot, 'media', 'diagram.jpg'), 'jpeg')
      write(root, join(inventoryRoot, 'media', 'photo.jpeg'), 'jpeg')
      write(root, join(inventoryRoot, 'media', 'animation.gif'), 'gif')
      write(root, join(inventoryRoot, 'media', 'icon.ico'), 'icon')
      write(root, join(inventoryRoot, 'media', 'legacy.eot'), 'font')
      write(root, join(inventoryRoot, 'runtime', 'loader.js'), '// supported extra asset')
      write(root, join(inventoryRoot, 'chunks', 'app.js.map'), '{}')
      write(root, join(inventoryRoot, 'chunks', 'runtime.wasm'), 'wasm')
      write(root, join(inventoryRoot, 'media', 'model.onnx'), 'model weights')
    } else if (tree === 'immutable') {
      write(root, join(inventoryRoot, 'immutable', 'chunks', 'app.js'), '// immutable chunk')
      write(root, join(inventoryRoot, 'immutable', 'css', 'page.css'), '/* immutable CSS */')
      write(root, join(inventoryRoot, 'immutable', 'media', 'font.woff2'), 'font')
    } else if (tree === 'js-only') {
      write(root, join(inventoryRoot, 'chunks', 'app.js'), '// app chunk')
    } else if (tree === 'manifest-only') {
      write(root, join(inventoryRoot, 'chunks', '_buildManifest.js'), '// build manifest')
      mkdirSync(join(inventoryRoot, 'media'), { recursive: true })
    }

    if (includeLegacyLocalTree && layout === 'adapter') {
      write(root, join('.next', 'static', 'chunks', 'local-only.js'), '// old local tree')
      write(root, join('.next', 'static', 'media', 'local-only.woff2'), 'old local font')
    }

    if (seedStaleManifests) {
      write(root, PUBLIC_MANIFEST, STALE_PUBLIC_MANIFEST)
      write(root, SERVED_MANIFEST, STALE_SERVED_MANIFEST)
    }

    if (servedManifestDirectory) {
      mkdirSync(join(root, SERVED_MANIFEST), { recursive: true })
    }

    return root
  } catch (error) {
    rmSync(root, { recursive: true, force: true })
    const rootIndex = fixtureRoots.indexOf(root)
    if (rootIndex !== -1) fixtureRoots.splice(rootIndex, 1)
    throw error
  }
}

/** Runs the real generator in a fixture and reports the exit status plus both streams. */
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

const readManifestText = (root: string, manifestPath = PUBLIC_MANIFEST): string =>
  readFileSync(join(root, manifestPath), 'utf8')

const ManifestSchema = z.object({ urls: z.array(z.string()) })

const readManifestUrls = (root: string): string[] =>
  ManifestSchema.parse(JSON.parse(readManifestText(root))).urls

describe('generate-precache-manifest', () => {
  afterEach(() => {
    for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  it('inventories classic chunks, standalone and nested CSS, media, and other supported assets', () => {
    const root = makeFixture({ tree: 'classic' })
    const result = runScript(root)

    expect(result.status).toBe(0)
    expect(readManifestUrls(root)).toEqual(
      expectedManifestUrls([
        '/_next/static/chunks/app.js',
        '/_next/static/chunks/nested/route.mjs',
        '/_next/static/css/app.css',
        '/_next/static/css/nested/page.css',
        '/_next/static/media/heading.woff2',
        '/_next/static/media/diagram.jpg',
        '/_next/static/media/photo.jpeg',
        '/_next/static/media/animation.gif',
        '/_next/static/media/icon.ico',
        '/_next/static/media/legacy.eot',
        '/_next/static/runtime/loader.js',
      ]),
    )
    const urls = readManifestUrls(root)
    expect(urls).not.toContain('/_next/static/chunks/app.js.map')
    expect(urls).not.toContain('/_next/static/chunks/runtime.wasm')
    expect(urls).not.toContain('/_next/static/media/model.onnx')
  })

  it('inventories immutable-only chunks, CSS, and media without classic directories', () => {
    const root = makeFixture({ tree: 'immutable' })
    const result = runScript(root)

    expect(result.status).toBe(0)
    expect(readManifestUrls(root)).toEqual(
      expectedManifestUrls([
        '/_next/static/immutable/chunks/app.js',
        '/_next/static/immutable/css/page.css',
        '/_next/static/immutable/media/font.woff2',
      ]),
    )
  })

  it('uses adapter-packaged assets and overwrites public and served manifests identically', () => {
    const root = makeFixture({
      layout: 'adapter',
      tree: 'classic',
      includeLegacyLocalTree: true,
      seedStaleManifests: true,
    })
    const result = runScript(root)

    expect(result.status).toBe(0)
    const publicManifest = readManifestText(root)
    expect(readManifestText(root, SERVED_MANIFEST)).toBe(publicManifest)
    expect(publicManifest).not.toContain('stale-')
    expect(readManifestUrls(root)).toEqual(
      expectedManifestUrls([
        '/_next/static/chunks/app.js',
        '/_next/static/chunks/nested/route.mjs',
        '/_next/static/css/app.css',
        '/_next/static/css/nested/page.css',
        '/_next/static/media/heading.woff2',
        '/_next/static/media/diagram.jpg',
        '/_next/static/media/photo.jpeg',
        '/_next/static/media/animation.gif',
        '/_next/static/media/icon.ico',
        '/_next/static/media/legacy.eot',
        '/_next/static/runtime/loader.js',
      ]),
    )
    expect(readManifestUrls(root)).not.toContain('/_next/static/chunks/local-only.js')
  })

  it('rejects a missing selected local root without writing a manifest', () => {
    const root = makeFixture({ tree: 'empty' })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('.next/static')
    expect(existsSync(join(root, PUBLIC_MANIFEST))).toBe(false)
  })

  it('does not fall back to a local tree when adapter-packaged assets are missing', () => {
    const root = makeFixture({
      layout: 'adapter',
      tree: 'empty',
      includeLegacyLocalTree: true,
    })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('.next/output/static/_next/static')
    expect(existsSync(join(root, PUBLIC_MANIFEST))).toBe(false)
  })

  it('rejects output containing only the Next build manifest and no real JS chunk', () => {
    const root = makeFixture({ tree: 'manifest-only' })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('JavaScript chunks')
    expect(existsSync(join(root, PUBLIC_MANIFEST))).toBe(false)
  })

  it('accepts a JavaScript-only build without CSS or media directories', () => {
    const root = makeFixture({ tree: 'js-only' })
    const result = runScript(root)

    expect(result.status).toBe(0)
    expect(readManifestUrls(root)).toEqual(expectedManifestUrls(['/_next/static/chunks/app.js']))
  })

  it('fails the build when overwriting the served adapter manifest fails', () => {
    const root = makeFixture({
      layout: 'adapter',
      tree: 'js-only',
      servedManifestDirectory: true,
    })
    const result = runScript(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toMatch(/EISDIR|directory/)
    expect(existsSync(join(root, PUBLIC_MANIFEST))).toBe(true)
  })
})
