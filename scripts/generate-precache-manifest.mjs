#!/usr/bin/env node
/**
 * Generate the service worker's precache list from the completed build output.
 *
 * Why this exists (Plan 158 P2-3): `public/sw.js` precached four hand-written
 * URLs. The HTML shell referenced fifteen Turbopack chunks, none of them
 * precached — so a cold offline boot had a cached document that could not
 * execute. On a local-first app whose entire promise is surviving a dropped
 * connection, that is the difference between working offline and a blank page.
 *
 * The static inventory is read from the completed build, not guessed from a
 * boot document. Adapter builds use their packaged
 * `.next/output/static/_next/static` inventory; local builds use `.next/static`.
 * Every emitted supported code, stylesheet, font, SVG, and raster image is
 * included recursively, including nested immutable paths. Source maps, WASM,
 * and model weights remain excluded.
 * The adapter's served manifest is written alongside its packaged assets so
 * it cannot remain stale after Vercel's missing-file-only public sync.
 *
 * Runs after `next build`. Output: `public/precache-manifest.json`, fetched
 * by the worker at install time.
 */

import { readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADAPTER_CONFIG = join(REPO_ROOT, '.next', 'output', 'config.json')
const ADAPTER_STATIC_ROOT = join(REPO_ROOT, '.next', 'output', 'static', '_next', 'static')
const LOCAL_STATIC_ROOT = join(REPO_ROOT, '.next', 'static')
const PUBLIC_MANIFEST = join(REPO_ROOT, 'public', 'precache-manifest.json')
const SERVED_MANIFEST = join(REPO_ROOT, '.next', 'output', 'static', 'precache-manifest.json')
const IS_ADAPTER_BUILD = existsSync(ADAPTER_CONFIG)
const BUILD_MODE = IS_ADAPTER_BUILD ? 'adapter' : 'local'
const STATIC_ASSET_ROOT = IS_ADAPTER_BUILD ? ADAPTER_STATIC_ROOT : LOCAL_STATIC_ROOT

/** URL prefix the selected static inventory is served under. */
const STATIC_URL_PREFIX = '/_next/static/'

/** Static files the app shell needs regardless of the bundle. */
const ALWAYS_INCLUDED = [
  '/',
  '/favicon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  // Declared in the manifest's `screenshots`, so they must be available
  // offline for the install prompt to render them.
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
]

/** JavaScript and stylesheet extensions the app can load at runtime. */
const CODE_EXTENSIONS = ['.js', '.mjs', '.css']

/**
 * Fonts and images referenced by views.
 *
 * Deliberately excludes `.wasm`, source maps, and model weights the AI harness
 * downloads on demand; they are user-opt-in media, not app code.
 */
const MEDIA_EXTENSIONS = [
  '.woff2',
  '.woff',
  '.ttf',
  '.eot',
  '.otf',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
]
const SUPPORTED_ASSET_EXTENSIONS = [...CODE_EXTENSIONS, ...MEDIA_EXTENSIONS]

/**
 * Collects supported emitted assets beneath `directory`, returning URLs
 * relative to the selected static inventory root.
 */
const collectStaticAssetUrls = async (directory, inventoryRoot, extensions) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const urls = []
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      urls.push(...(await collectStaticAssetUrls(absolute, inventoryRoot, extensions)))
    } else if (extensions.includes(extname(entry.name))) {
      const relativePath = relative(inventoryRoot, absolute).split(sep).join('/')
      urls.push(`${STATIC_URL_PREFIX}${relativePath}`)
    }
  }
  return urls
}

const main = async () => {
  if (!existsSync(STATIC_ASSET_ROOT)) {
    console.error(
      `[precache] ${relative(REPO_ROOT, STATIC_ASSET_ROOT)} not found for the ` +
        `${BUILD_MODE} build output. Re-run \`pnpm run build\` before generating ` +
        'the precache list.',
    )
    process.exitCode = 1
    return
  }

  const staticAssets = await collectStaticAssetUrls(
    STATIC_ASSET_ROOT,
    STATIC_ASSET_ROOT,
    SUPPORTED_ASSET_EXTENSIONS,
  )
  const hasRealJavascriptChunk = staticAssets.some((url) => {
    const assetPath = url.slice(STATIC_URL_PREFIX.length)
    const isChunk = assetPath.startsWith('chunks/') || assetPath.startsWith('immutable/chunks/')
    return isChunk && assetPath.endsWith('.js') && !assetPath.endsWith('/_buildManifest.js')
  })

  if (!hasRealJavascriptChunk) {
    console.error(
      `[precache] no real JavaScript chunks found under ${relative(REPO_ROOT, STATIC_ASSET_ROOT)}. ` +
        'Refusing to write a manifest without an emitted app chunk.',
    )
    process.exitCode = 1
    return
  }

  const urls = [...new Set([...ALWAYS_INCLUDED, ...staticAssets])].sort()
  const manifest = `${JSON.stringify({ urls }, null, 2)}\n`

  await writeFile(PUBLIC_MANIFEST, manifest, 'utf8')
  if (IS_ADAPTER_BUILD) {
    await writeFile(SERVED_MANIFEST, manifest, 'utf8')
  }

  const destinations = IS_ADAPTER_BUILD
    ? 'public/precache-manifest.json and .next/output/static/precache-manifest.json'
    : 'public/precache-manifest.json'
  console.log(
    `[precache] wrote ${urls.length} URLs to ${destinations} from ${BUILD_MODE} ` +
      `output (${staticAssets.length} supported assets: ${CODE_EXTENSIONS.join(', ')}; ` +
      `${MEDIA_EXTENSIONS.join(', ')})`,
  )
}

await main()
