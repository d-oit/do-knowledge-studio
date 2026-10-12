#!/usr/bin/env node
/**
 * Generate the service worker's precache list from the real build output.
 *
 * Why this exists (Plan 158 P2-3): `public/sw.js` precached four hand-written
 * URLs. The HTML shell referenced fifteen Turbopack chunks, none of them
 * precached — so a cold offline boot had a cached document that could not
 * execute. On a local-first app whose entire promise is surviving a dropped
 * connection, that is the difference between working offline and a blank page.
 *
 * The boot set is derived from the emitted HTML's own script/style references,
 * plus a full inventory of the emitted static assets. The HTML alone is only
 * what the initial document needs; the app code-splits six views (Graph, Mind
 * Map, AI Harness, TRIZ, Export, Sync), and those chunks appear in no HTML —
 * so a boot-only list left a first offline navigation into any of them to
 * reject its dynamic import (plans/161). Inventories are read from the build
 * directory, never hardcoded, so renamed hashes cannot silently fall out.
 *
 * Runs after `next build`. Output: `public/precache-manifest.json`, fetched
 * by the worker at install time.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_HTML = join(REPO_ROOT, '.next', 'server', 'app', 'index.html')
const NEXT_STATIC_DIR = join(REPO_ROOT, '.next', 'static')
const CHUNKS_DIR = join(NEXT_STATIC_DIR, 'chunks')
const MEDIA_DIR = join(NEXT_STATIC_DIR, 'media')
const OUTPUT = join(REPO_ROOT, 'public', 'precache-manifest.json')

/** URL prefix the emitted static directory is served under. */
const STATIC_URL_PREFIX = '/_next/static'

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

/**
 * Pulls root-relative asset URLs out of the built document.
 *
 * A single pattern with backslashes excluded from the character class is used
 * deliberately: an earlier permissive pass captured the escaping backslash
 * from HTML entities, yielding entries like `<file>.js\` that 404 when
 * fetched. Each match is additionally validated against a known extension.
 */
const extractAssetUrls = (html) => {
  const pattern = /["'](\/_next\/static\/[^"'\\\s]+?)["']/g
  const found = new Set()
  for (const match of html.matchAll(pattern)) {
    // Strip any cache-busting query so the worker caches one canonical entry.
    const clean = match[1].split('?')[0]
    const extension = clean.split('.').pop()
    if (ASSET_EXTENSIONS.includes(extension)) found.add(clean)
  }
  return [...found].sort()
}

/**
 * Extensions of emitted code the app can load at runtime.
 *
 * Every chunk under `.next/static/chunks` is precached rather than trying to
 * attribute chunks to features: the names are content hashes, so classification
 * would mean parsing minified source, and a wrong guess is an offline view that
 * cannot load.
 */
const CODE_EXTENSIONS = ['.js', '.mjs', '.css']

/**
 * Extensions of emitted fonts and images referenced by views.
 *
 * Deliberately excludes `.wasm` and the large model weights the AI harness
 * downloads on demand: those are media the user opts into, not app code, and
 * one of them alone exceeds the whole chunk set.
 */
const MEDIA_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf', '.svg', '.png', '.webp', '.avif']

/**
 * The same set as the two inventories above, in the dotless form the document
 * scan compares against. Derived rather than restated: two lists describing one
 * extension set drift, and a drift here silently drops an asset from precache.
 */
const ASSET_EXTENSIONS = [...CODE_EXTENSIONS, ...MEDIA_EXTENSIONS].map((extension) =>
  extension.slice(1),
)

/**
 * Collects files under `directory` whose extension is in `extensions`,
 * returned as `/_next/static/...` URLs.
 *
 * Paths are derived from the real build directory and rewritten with forward
 * slashes so a Windows checkout still emits URLs, not paths.
 */
const collectStaticAssetUrls = async (directory, extensions) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const urls = []
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      urls.push(...(await collectStaticAssetUrls(absolute, extensions)))
    } else if (extensions.includes(extname(entry.name))) {
      const relativePath = relative(NEXT_STATIC_DIR, absolute).split(sep).join('/')
      urls.push(`${STATIC_URL_PREFIX}/${relativePath}`)
    }
  }
  return urls
}

const main = async () => {
  if (!existsSync(BUILD_HTML)) {
    console.error(
      `[precache] ${BUILD_HTML} not found. Run \`pnpm run build\` first — the ` +
        'precache list is derived from the real build output.',
    )
    process.exitCode = 1
    return
  }

  for (const directory of [CHUNKS_DIR, MEDIA_DIR]) {
    if (!existsSync(directory)) {
      console.error(
        `[precache] ${directory} not found. The build output is incomplete — ` +
          're-run `pnpm run build` before generating the precache list.',
      )
      process.exitCode = 1
      return
    }
  }

  const html = await readFile(BUILD_HTML, 'utf8')
  const bootAssets = extractAssetUrls(html)
  const codeAssets = await collectStaticAssetUrls(CHUNKS_DIR, CODE_EXTENSIONS)

  // A build whose chunk directory holds no JavaScript is not a build this
  // manifest can describe: emitting it would silently precache a boot-only
  // shell again, which is exactly the regression this list exists to prevent.
  if (!codeAssets.some((url) => url.endsWith('.js') || url.endsWith('.mjs'))) {
    console.error(
      `[precache] no JavaScript chunks found under ${CHUNKS_DIR}. Refusing to ` +
        'write a manifest that cannot satisfy a lazy view import.',
    )
    process.exitCode = 1
    return
  }

  const mediaAssets = await collectStaticAssetUrls(MEDIA_DIR, MEDIA_EXTENSIONS)
  const staticAssets = [...codeAssets, ...mediaAssets]
  const urls = [...new Set([...ALWAYS_INCLUDED, ...bootAssets, ...staticAssets])].sort()

  await writeFile(OUTPUT, `${JSON.stringify({ urls }, null, 2)}\n`, 'utf8')
  console.log(
    `[precache] wrote ${urls.length} URLs to public/precache-manifest.json ` +
      `(${bootAssets.length} from the document, ${codeAssets.length} chunks, ` +
      `${mediaAssets.length} media)`,
  )
}

await main()
