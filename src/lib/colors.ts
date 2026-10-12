/**
 * Literal color values for contexts that cannot use a Tailwind class or a CSS
 * custom property (#853, TOK-9).
 *
 * Most of the app colors itself with `globals.css` tokens. Three consumers
 * cannot: remote-peer cursors and presence markers are painted onto SVG with
 * literal fills, the standalone HTML export must render with no stylesheet of
 * ours, and the mind map PNG needs a background when an element has no computed
 * color. Those hex clusters used to live in four separate modules and drift
 * independently; they live here so a palette change is one edit.
 */

/**
 * Colors assigned to connected peers, in assignment order. Used for remote
 * cursor indicators (`sync/cursors.ts`) and presence avatars
 * (`sync/presence.ts`); both pools previously carried slightly different
 * subsets of this list.
 */
export const PEER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9',
] as const

/**
 * Background painted behind a PNG export when the source element has no
 * computed background color (`views/mindmap-export.ts`). Mirrors
 * `--background` (`#faf8f3`).
 */
export const CANVAS_FALLBACK_BACKGROUND = '#faf8f3'

/**
 * Palette for the standalone HTML export document
 * (`views/export-helpers.ts`). Each value mirrors the `globals.css` token
 * named beside it; the duplication is deliberate because the exported file
 * must be self-contained and cannot reference our custom properties.
 */
export const EXPORT_COLORS = {
  /** `--foreground` */
  foreground: '#1a1814',
  /** `--background` */
  background: '#faf8f3',
  /** `--border` */
  border: '#e5e1d8',
  /** `--muted` */
  muted: '#f1ede4',
  /** `--ink-mute` */
  inkMute: '#6b6760',
  /** `--ink-faint` */
  inkFaint: '#9c978d',
  /** `--saffron-soft` */
  saffronSoft: '#f5e8d5',
  /** `--saffron-deep` */
  saffronDeep: '#8a4f1c',
  /** Note entity badge surface */
  typeNoteBg: '#e0eaf2',
  /** Note entity badge text */
  typeNoteText: '#2b4d6b',
  /** Person entity badge surface */
  typePersonBg: '#f3dcd2',
  /** Person entity badge text */
  typePersonText: '#8a3320',
  /** Project entity badge surface */
  typeProjectBg: '#dce8df',
  /** Project entity badge text */
  typeProjectText: '#2f5b4a',
  /** Verified claim badge surface */
  verifiedBg: '#d4ead4',
  /** Verified claim badge text */
  verifiedText: '#1f6b1f',
  /** Disputed claim badge surface */
  disputedBg: '#f5e3c8',
} as const
