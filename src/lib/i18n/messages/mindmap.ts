/**
 * Mind map i18n messages.
 *
 * User-facing strings for the mind map view (Plan 157 Phase 1). The density
 * names live here rather than beside the CSS tokens so the token module
 * stays purely visual and localization has a single entry point.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Density toggle label while the tree is in its comfortable spacing. */
  'mindmap.density.comfortable': 'Comfortable',
  /** Density toggle label while the tree is in its compact spacing. */
  'mindmap.density.compact': 'Compact',
  /** Accessible name of the density toggle button. */
  'mindmap.density.toggle': 'Compact view',
  /** Density name shown in the status bar. */
  'mindmap.density.status': (density: string) => density,
  /** Status bar segment naming the tree root. */
  'mindmap.status.root': 'Root',
  /** Status bar shown when the library has no linkable entities. */
  'mindmap.status.empty': 'No data',
  /** Status bar segment counting direct children of the root. */
  'mindmap.status.children': (count: string) => `${count} direct children`,
  /** Status bar segment naming the rendered tree depth. */
  'mindmap.status.depth': (depth: string) => `depth ${depth}`,
} as const

/** Typed `translate` helper bound to the mind map message scope. */
export const translate = makeT(messages)
