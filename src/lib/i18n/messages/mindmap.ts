/**
 * Mind map i18n messages.
 *
 * User-facing strings for the mind map view (Plan 157 Phase 1). The density
 * names live here rather than beside the CSS tokens so the token module
 * stays purely visual and localization has a single entry point.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the mind map toolbar. */
  'mindmap.toolbar.ariaLabel': 'Mind map controls',
  /** Accessible label of the root-entity picker in the toolbar. */
  'mindmap.toolbar.rootLabel': 'Root entity',
  /** Visible label of the depth slider in the toolbar. */
  'mindmap.toolbar.depthLabel': 'Depth',
  /** Accessible label of the depth slider in the toolbar. */
  'mindmap.toolbar.depthAriaLabel': 'Tree depth',
  /** Toolbar action: add a child node to the focused node. */
  'mindmap.toolbar.addChild': 'Add child',
  /** Toolbar action: rename the focused node. */
  'mindmap.toolbar.rename': 'Rename',
  /** Toolbar action: delete the focused node. */
  'mindmap.toolbar.delete': 'Delete',
  /** Toolbar action: undo the last tree edit. */
  'mindmap.toolbar.undo': 'Undo',
  /** Toolbar action: redo the last undone tree edit. */
  'mindmap.toolbar.redo': 'Redo',
  /** Toolbar action: re-read the tree from the store. */
  'mindmap.toolbar.sync': 'Sync',
  /** Toolbar action: export the tree as a PNG. */
  'mindmap.toolbar.exportPng': 'Export PNG',
  /** Tooltip of a disabled undo/redo button; action label interpolated. */
  'mindmap.toolbar.disabledHint': (label: string) => `${label} (nothing to undo/redo)`,
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
