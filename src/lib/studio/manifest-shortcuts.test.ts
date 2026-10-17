/**
 * The manifest's `shortcuts` member (W3C Web Application Manifest §1.14) is a
 * second entry point into the app: the OS context menu launches `/#/<view>` and
 * the app resolves that hash through `parseViewHash`. Nothing tied the two
 * together, so a typo such as `/#/libary` would silently land on Home —
 * `parseViewHash` falls back on `home` for unknown routes — and only surface
 * after a real install.
 *
 * §3.7 requires each shortcut item to carry a non-empty `name` and a `url` that
 * parses and stays within the manifest's scope. This reads the shipped manifest
 * and resolves every URL through the app's own hash helpers rather than a copy
 * of them.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isKnownViewHash, parseViewHash, viewToHash } from './view-hash'
import type { ViewId } from './types'

/** Manifests are served from the site root, so relative shortcut URLs resolve against it. */
const MANIFEST_URL = 'https://studio.example/manifest.webmanifest'
/** Chrome's minimum side for a shortcut icon (the spec itself sets no minimum). */
const SHORTCUT_ICON_MIN_PX = 96

interface ManifestIcon {
  src: string
  sizes?: string
  type?: string
}

interface ShortcutItem {
  name: string
  short_name?: string
  description?: string
  url: string
  icons?: ManifestIcon[]
}

interface WebManifest {
  scope?: unknown
  shortcuts?: ShortcutItem[]
}

const repoRoot = join(__dirname, '..', '..', '..')
const manifest = JSON.parse(
  readFileSync(join(repoRoot, 'public', 'manifest.webmanifest'), 'utf8'),
) as WebManifest

/** Destinations the context menu offers, in priority order (spec: most critical first). */
const EXPECTED_SHORTCUTS: Record<string, ViewId> = {
  '/#/editor': 'editor',
  '/#/library': 'library',
  '/#/graph': 'graph',
  '/#/mindmap': 'mindmap',
}

/** Smallest dimension of a manifest `sizes` value (`'192x192'`), or null when unparseable. */
const smallestIconSide = (sizes: string | undefined): number | null => {
  const match = /^(\d+)x(\d+)$/.exec(sizes ?? '')
  return match === null ? null : Math.min(Number(match[1]), Number(match[2]))
}

describe('manifest.webmanifest shortcuts', () => {
  const shortcuts = manifest.shortcuts ?? []

  it('offers the highest-value views only, in priority order', () => {
    // Pins the exact set (3–4 entries): a shortcut added for a low-value view
    // has to be a deliberate edit here, not a silent manifest change.
    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual(Object.keys(EXPECTED_SHORTCUTS))
  })

  it('gives every shortcut the name and url the spec requires', () => {
    expect(shortcuts.length).toBeGreaterThan(0)
    for (const shortcut of shortcuts) {
      // `typeof` first: a missing member must fail here, not as a TypeError on
      // the `.trim()` below.
      expect(typeof shortcut.name).toBe('string')
      expect(typeof shortcut.url).toBe('string')
      expect(shortcut.name.trim()).not.toBe('')
      expect(shortcut.url.trim()).not.toBe('')
    }
  })

  it('resolves every shortcut url through the app’s own view-hash parser', () => {
    expect(manifest.scope).toBe('/')
    for (const shortcut of shortcuts) {
      const url = new URL(shortcut.url, MANIFEST_URL)
      // §3.7 drops a shortcut whose url leaves the manifest's scope.
      expect(url.origin).toBe(new URL(MANIFEST_URL).origin)

      const hash = url.hash
      expect(isKnownViewHash(hash)).toBe(true)

      const view = parseViewHash(hash)
      expect(view).toBe(EXPECTED_SHORTCUTS[shortcut.url])
      // `parseViewHash` falls back to `home` for unknown routes, so round-trip
      // through `viewToHash`: the hash must be the canonical route of that view.
      expect(view === null ? null : viewToHash(view)).toBe(hash)
    }
  })

  it('points supplied shortcut icons at real files of at least 96px', () => {
    const icons = shortcuts.flatMap((shortcut) =>
      (shortcut.icons ?? []).map((icon) => ({ ...icon, side: smallestIconSide(icon.sizes) })),
    )
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      expect(icon.side).toBeGreaterThanOrEqual(SHORTCUT_ICON_MIN_PX)
      expect(existsSync(join(repoRoot, 'public', icon.src))).toBe(true)
    }
  })
})
