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
 * The list is derived from the emitted HTML's own script/style references
 * rather than a glob of the output directory. The HTML is exactly what the
 * browser needs to boot, so this cannot over- or under-shoot the real boot
 * set as Next's chunking changes.
 *
 * Runs after `next build`. Output: `public/precache-manifest.json`, fetched
 * by the worker at install time.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_HTML = join(REPO_ROOT, '.next', 'server', 'app', 'index.html')
const OUTPUT = join(REPO_ROOT, 'public', 'precache-manifest.json')

/** Static files the app shell needs regardless of the bundle. */
const ALWAYS_INCLUDED = [
  '/',
  '/favicon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
]

/**
 * Pulls root-relative asset URLs out of the built document.
 *
 * A single pattern with backslashes excluded from the character class is used
 * deliberately: an earlier permissive pass captured the escaping backslash
 * from HTML entities, yielding entries like `<file>.js\` that 404 when
 * fetched. Each match is additionally validated against a known extension.
 */
const ASSET_EXTENSIONS = ['js', 'css', 'woff2', 'woff', 'ttf', 'otf', 'svg', 'png', 'webp', 'avif']

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

const main = async () => {
  if (!existsSync(BUILD_HTML)) {
    console.error(
      `[precache] ${BUILD_HTML} not found. Run \`pnpm run build\` first — the ` +
        'precache list is derived from the real build output.',
    )
    process.exitCode = 1
    return
  }

  const html = await readFile(BUILD_HTML, 'utf8')
  const assets = extractAssetUrls(html)
  const urls = [...new Set([...ALWAYS_INCLUDED, ...assets])].sort()

  await writeFile(OUTPUT, `${JSON.stringify({ urls }, null, 2)}\n`, 'utf8')
  console.log(
    `[precache] wrote ${urls.length} URLs to public/precache-manifest.json ` +
      `(${assets.length} from the build output)`,
  )
}

await main()
