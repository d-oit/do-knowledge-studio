import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The service worker and the precache generator describe one extension set in
 * two places, and nothing tied them together: `.avif` was listed in the
 * generator's media inventory while `public/sw.js` did not serve it cache-first,
 * so the file was precached during install and then fetched from the network —
 * missing offline, which is the whole point of the manifest (review on PR #925).
 *
 * The two files cannot import one another (`sw.js` is served verbatim, the
 * generator runs at build time in Node), so this test reads both and fails when
 * the worker stops covering what the generator can emit.
 */
const repoRoot = join(__dirname, '..', '..', '..')
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8')

/** Extensions named in a JS array literal of quoted strings. */
const extensionsIn = (source: string, arrayName: string): string[] => {
  const match = source.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]`))
  if (match === null) throw new Error(`${arrayName} not found in source`)
  // The generator writes its list with a leading dot ('.woff2') while the worker
// omits it ('"woff2"'), so both are normalised to the dotless form.
  return [...match[1].matchAll(/["'](\.?[\w]+)["']/g)]
    .map((entry) => entry[1].replace(/^\./, ''))
}

describe('precache manifest ↔ service worker parity', () => {
  it('serves cache-first every media extension the generator can precache', () => {
    const generator = read(join('scripts', 'generate-precache-manifest.mjs'))
    const worker = read(join('public', 'sw.js'))

    const media = extensionsIn(generator, 'MEDIA_EXTENSIONS')
    const served = extensionsIn(worker, 'STATIC_EXTENSIONS')

    expect(media.length).toBeGreaterThan(0)
    expect(served.length).toBeGreaterThan(0)
    // Every precached media type must be matched as a static asset, or the file
    // is downloaded at install time and unreachable while offline.
    expect(media.filter((ext) => !served.includes(ext))).toEqual([])
  })

  it('serves cache-first every code extension the generator inventories', () => {
    const generator = read(join('scripts', 'generate-precache-manifest.mjs'))
    const worker = read(join('public', 'sw.js'))

    const served = extensionsIn(worker, 'STATIC_EXTENSIONS')
    const code = extensionsIn(generator, 'CODE_EXTENSIONS')

    expect(code.length).toBeGreaterThan(0)
    // The chunk inventory is a third source: a `.css` dropped from the worker's
    // list would leave every stylesheet precached and unserved offline.
    expect(code.filter((ext) => !served.includes(ext))).toEqual([])
  })

  it('serves cache-first every extension the always-included URLs use', () => {
    const generator = read(join('scripts', 'generate-precache-manifest.mjs'))
    const worker = read(join('public', 'sw.js'))

    const served = extensionsIn(worker, 'STATIC_EXTENSIONS')
    // The generator's explicit list is URLs, not extensions: the static files
    // the app shell needs regardless of the bundle. `manifest.webmanifest` came
    // from here and was precached-but-unserved until this test existed.
    const urls = (generator.match(/ALWAYS_INCLUDED\s*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? ''
    const extensions = [...urls.matchAll(/["']\/(?:[\w./-]*\/)?[\w.-]*\.([\w]+)["']/g)].map(
      (entry) => entry[1],
    )

    expect(extensions.length).toBeGreaterThan(0)
    expect(extensions.filter((ext) => !served.includes(ext))).toEqual([])
  })
})
