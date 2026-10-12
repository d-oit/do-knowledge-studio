/**
 * Snapshot of the design tokens for the standalone HTML documents that are
 * written out as downloadable files (`buildHtmlExport` / the encrypted
 * reader). Those documents are opened outside the app, so they cannot use the
 * CSS custom properties from `src/app/globals.css` — the values are baked in
 * here instead, in ONE place.
 *
 * Every value below is the light-theme value of the matching token in
 * `src/app/globals.css` (`:root`), because an export always renders on paper.
 * Keep this module in sync with that file — it is the only place in
 * `src/lib/export` + `src/components/studio/views/export-helpers.ts` where a
 * literal colour may live.
 */
export const EXPORT_COLORS = {
  /** `--background` — warm paper page. */
  paper: '#faf8f3',
  /** `--surface-sunken` — recessed wells (code content, `<pre>`). */
  paperSunken: '#f1ede4',
  /** `--ink` — strongest text. */
  ink: '#1a1814',
  /** `--ink-soft` — body copy. */
  inkSoft: '#3a3530',
  /** `--ink-mute` — secondary text, metadata. */
  inkMute: '#5c5852',
  /** `--border` — dividers, input borders. */
  border: '#e5e1d8',
  /** `--primary` — solid ink buttons. */
  primary: '#1a1814',
  /** `--primary-foreground` — text on a primary button. */
  primaryForeground: '#faf8f3',
  /** `--saffron` — brand accent, also the `concept` entity hue. */
  saffron: '#9a5c2a',
  /** `--saffron-deep` — AA accent text on a saffron tint. */
  saffronDeep: '#6a4a1c',
  /** `--sky` — the `note` entity hue. */
  sky: '#6b8aa8',
  /** `--sky-deep` — AA sky text on a sky tint. */
  skyDeep: '#2b4d6b',
  /** `--clay` — the `person` entity hue. */
  clay: '#b8593a',
  /** `--clay-deep` — AA clay text on a clay tint. */
  clayDeep: '#8a3320',
  /** `--sage` — the `project` entity hue. */
  sage: '#587465',
  /** `--sage-deep` — AA sage text on a sage tint. */
  sageDeep: '#2f5b4a',
  /** `--destructive` — error text. */
  destructive: '#b91c1c',
  /**
   * Claim-verification ramp. Deliberately distinct from the entity hues so a
   * verdict badge never reads as an entity type; has no `@theme` token yet
   * (a standalone document cannot depend on app-only variables).
   */
  verified: '#1f6b1f',
  disputed: '#8a4f1c',
  unverified: '#5c5852',
} as const

/** Alpha (percent) used for the tinted backgrounds behind export badges. */
const TINT_ALPHA = 15

/**
 * Renders a translucent tint of `color` — the export equivalent of Tailwind
 * v4's `bg-<token>/15` opacity modifier, which also compiles to `color-mix()`.
 */
export const tint = (color: string): string =>
  `color-mix(in oklab, ${color} ${TINT_ALPHA}%, transparent)`
