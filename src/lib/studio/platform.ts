/**
 * Platform detection for shortcut labels. The app's mod-key handlers all
 * accept `metaKey || ctrlKey` (tiptap convention), so the *binding* is
 * cross-platform — only the displayed glyph differs: ⌘ on macOS, Ctrl+
 * everywhere else (#872).
 */

/** True on macOS/iOS, where shortcuts render with the ⌘ glyph. */
export const IS_MAC_PLATFORM: boolean =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform)

/**
 * Renders a shortcut string for the current platform: macOS keeps the
 * ⌘/⇧ glyphs untouched; other platforms get Ctrl+/Shift+ text labels.
 */
export const formatShortcut = (keys: string): string =>
  IS_MAC_PLATFORM ? keys : keys.replaceAll('⌘', 'Ctrl+').replaceAll('⇧', 'Shift+')
