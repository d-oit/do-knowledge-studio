/**
 * Mind map tree density tokens (Plan 157 Phase 1, closes D4.2).
 *
 * The "Compact" toolbar toggle used to flip state that nothing read. These
 * tokens are the single source of truth for both density steps so the
 * toolbar, the node renderer, and the type scale cannot drift apart.
 *
 * Compact reclaims space from chrome only — padding, indent, branch gaps,
 * and type size. Interactive targets keep their 44px floor (AGENTS.md UI
 * guardrails / WCAG 2.5.8), so the toggle is a density control, never an
 * accessibility setting.
 */

/** Padding, gaps, and type sizes applied to a mind map tree at each density. */
export interface MindMapDensity {
  /** Per-level horizontal indent in px — tighter when compact. */
  indentPx: number
  /** Vertical padding on a node row. */
  nodePaddingY: string
  /** Horizontal padding on a nested node row. */
  nodePaddingX: string
  /** Horizontal padding on the root row (the root gets extra breathing room). */
  rootPaddingX: string
  /** Vertical gap between sibling branches. */
  siblingGap: string
  /** Label font size for nested nodes. */
  nestedLabelSize: string
  /** Label font size for the root node. */
  rootLabelSize: string
  /** Type scale of the type badge beside each node label. */
  badgeScale: string
  /** Left offset of the connector rail below each expanded node. */
  connectorInset: string
  /** Horizontal padding of the nested branch rail. */
  railPadding: string
  /** Height of the connector tick under an expanded node. */
  connectorHeight: string
}

/** Comfortable default density. */
export const ROOMY_DENSITY: MindMapDensity = {
  indentPx: 28,
  nodePaddingY: 'py-1.5',
  nodePaddingX: 'px-3',
  rootPaddingX: 'px-4',
  siblingGap: 'space-y-1',
  nestedLabelSize: 'text-[13px]',
  rootLabelSize: 'text-[15px]',
  badgeScale: 'text-badge',
  connectorInset: 'ml-4',
  railPadding: 'pl-2',
  connectorHeight: 'h-3',
}

/**
 * Denser density: tighter padding, indentation, branch gaps, and type, so a
 * deep tree fits on one screen without shrinking the controls themselves.
 */
export const COMPACT_DENSITY: MindMapDensity = {
  indentPx: 18,
  nodePaddingY: 'py-1',
  nodePaddingX: 'px-2.5',
  rootPaddingX: 'px-2.5',
  siblingGap: 'space-y-0.5',
  nestedLabelSize: 'text-[12px]',
  rootLabelSize: 'text-[13px]',
  badgeScale: 'text-[10px]',
  connectorInset: 'ml-3',
  railPadding: 'pl-1',
  connectorHeight: 'h-2',
}

/** Resolves the density tokens for the current compact toggle state. */
export const getMindMapDensity = (compact: boolean): MindMapDensity =>
  compact ? COMPACT_DENSITY : ROOMY_DENSITY
