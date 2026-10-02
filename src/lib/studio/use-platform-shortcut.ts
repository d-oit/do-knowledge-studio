'use client'

import { useSyncExternalStore } from 'react'

/**
 * Platform detection for shortcut labels. The app's mod-key handlers all
 * accept `metaKey || ctrlKey` (tiptap convention), so the *binding* is
 * cross-platform — only the displayed glyph differs: ⌘ on macOS, Ctrl+
 * everywhere else (#872).
 *
 * Hydration note: platform values live outside React state, so a plain
 * module-scope `navigator.platform` read would render one label in the SSR
 * HTML and re-derive a different label during hydration — a text mismatch on
 * the very first paint. Same class of bug as `useReducedMotion`
 * (plans/161), same cure: `useSyncExternalStore` keeps a single snapshot
 * stable across server render and hydration pass, then re-reads the real
 * platform as soon as hydration finishes (subscribe is a no-op — the
 * platform of a tab does not change at runtime).
 */

const getSnapshot = (): boolean =>
  typeof navigator !== 'undefined' && navigator.platform
    ? /mac|iphone|ipad|ipod/i.test(navigator.platform)
    : false

const getServerSnapshot = (): boolean => false

const subscribe = (): (() => void) => () => {}

/** True on macOS/iOS, where shortcuts render with the ⌘ glyph. */
export const useIsMacPlatform = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

/**
 * Renders a shortcut string for the current platform: macOS keeps the
 * ⌘/⇧ glyphs untouched; other platforms get Ctrl+/Shift+ text labels.
 */
export const formatShortcut = (keys: string, isMac: boolean): string =>
  isMac ? keys : keys.replaceAll('⌘', 'Ctrl+').replaceAll('⇧', 'Shift+')
