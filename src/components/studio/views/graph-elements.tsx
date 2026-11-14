'use client'

import { type GraphEdge, type GraphNode } from '@/lib/studio/types'
import { cn } from '@/lib/utils'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'

/** Node dot radius in px; the selected node draws larger. */
const NODE_RADIUS = 11
const SELECTED_NODE_RADIUS = 14

/** Dashed selection ring, drawn this far outside the node radius. */
const SELECTION_RING_OFFSET = 6

/** Decorative core dot radius as a fraction of the node radius. */
const NODE_CORE_RATIO = 0.4

/** Label baseline offset below the node radius. */
const LABEL_OFFSET_PX = 14

/** Node labels longer than this are truncated to keep the row readable. */
const LABEL_MAX_CHARS = 24
const LABEL_CUT_CHARS = 22

/** CSS filter applied to focused nodes in focus mode. */
export const FOCUS_MODE_FILTER_STYLE: React.CSSProperties = {
  filter: 'drop-shadow(0 0 3px var(--saffron))',
} as const

/** Perpendicular offset (px) of the highlighted-edge relation label. */
const EDGE_LABEL_OFFSET_PX = 14

/** True when the edge touches the selected entity (drives highlight styling). */
const isEdgeHighlighted = (edge: GraphEdge, selectedEntityId: string | null): boolean =>
  Boolean(selectedEntityId) &&
  (edge.source === selectedEntityId || edge.target === selectedEntityId)

/** Highlighted vs default stroke styling for an edge line. */
const EDGE_STROKE: Record<'highlighted' | 'default', { className: string; width: number }> = {
  highlighted: { className: 'stroke-saffron', width: 2 },
  default: { className: 'stroke-border', width: 1.5 },
}

/** Relation label at the highlighted edge midpoint, perpendicular to the line. */
const EdgeRelationLabel = ({
  sourceNode,
  targetNode,
  relation,
}: {
  sourceNode: GraphNode
  targetNode: GraphNode
  relation: string
}) => {
  const dx = targetNode.x - sourceNode.x
  const dy = targetNode.y - sourceNode.y
  const edgeLength = Math.hypot(dx, dy) || 1
  // The perpendicular unit vector is (-dy, dx) / length.
  const labelX = (sourceNode.x + targetNode.x) / 2 + (-dy / edgeLength) * EDGE_LABEL_OFFSET_PX
  const labelY = (sourceNode.y + targetNode.y) / 2 + (dx / edgeLength) * EDGE_LABEL_OFFSET_PX

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor="middle"
      dominantBaseline="central"
      stroke="var(--background)"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      className="fill-ink-mute font-sans text-badge italic"
    >
      {relation}
    </text>
  )
}

/**
 * Edge line + (when highlighted) relation label.
 *
 * Extracted from `graph-view.tsx` to keep that module under the repository's
 * 500-LOC limit (Plan 159 follow-on F6). The render body and z-order are
 * unchanged: the label is drawn after its line and only while highlighted.
 */
export const GraphEdgeElement = ({
  edge,
  sourceNode,
  targetNode,
  selectedEntityId,
  pathHighlighted = false,
  showRelationLabel = true,
}: {
  edge: GraphEdge
  sourceNode: GraphNode
  targetNode: GraphNode
  selectedEntityId: string | null
  /** Whether this edge lies on the recovered shortest path (#1058). */
  pathHighlighted?: boolean
  /** Level-of-detail switch: relation labels are hidden on large, zoomed-out graphs. */
  showRelationLabel?: boolean
}) => {
  const isHighlighted = isEdgeHighlighted(edge, selectedEntityId) || pathHighlighted
  const stroke = EDGE_STROKE[isHighlighted ? 'highlighted' : 'default']

  return (
    <g>
      <line
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x}
        y2={targetNode.y}
        className={cn('transition-all', stroke.className)}
        strokeWidth={stroke.width}
      />
      {isHighlighted && showRelationLabel && (
        <EdgeRelationLabel
          sourceNode={sourceNode}
          targetNode={targetNode}
          relation={edge.relation}
        />
      )}
    </g>
  )
}

/**
 * One graph node: dot, selection ring, optional core and label.
 *
 * Extracted from `graph-view.tsx` to keep that module under the repository's
 * 500-LOC limit while it gained roving-tabindex keyboard navigation
 * (plans/213). Render output is unchanged.
 */
export const GraphNodeElement = ({
  node,
  selected,
  focused,
  onPath,
  showLabel,
  showCore,
  animDur,
  tabIndex,
  onSelect,
  onKeyDown,
  onFocusNode,
  onBlurNode,
}: {
  node: GraphNode
  selected: boolean
  focused: boolean
  /** Whether the node lies on the recovered shortest path (#1058). */
  onPath: boolean
  /** Level-of-detail switches; both are off above the label threshold. */
  showLabel: boolean
  showCore: boolean
  animDur: string
  /** Roving tabindex: 0 only for the single tabbable node. */
  tabIndex: number
  onSelect: (nodeId: string, selected: boolean) => void
  onKeyDown: (nodeId: string, event: React.KeyboardEvent<SVGGElement>) => void
  onFocusNode: (nodeId: string) => void
  onBlurNode: () => void
}) => {
  const meta = getEntityTypeMeta(node.type)
  const radius = selected ? SELECTED_NODE_RADIUS : NODE_RADIUS
  const label = node.label.length > LABEL_MAX_CHARS
    ? `${node.label.slice(0, LABEL_CUT_CHARS)}…`
    : node.label

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      onClick={() => {
        onSelect(node.id, selected)
      }}
      onKeyDown={(event) => { onKeyDown(node.id, event) }}
      onFocus={() => { onFocusNode(node.id) }}
      onBlur={onBlurNode}
      tabIndex={tabIndex}
      role="button"
      aria-label={`${node.label} — ${meta.label}${selected ? ' (selected)' : ''}${onPath ? ' (on path)' : ''}`}
      className={cn(
        'cursor-pointer outline-none',
        (focused || selected) && 'focus-visible:ring-2 focus-visible:ring-saffron/60',
      )}
      style={focused ? FOCUS_MODE_FILTER_STYLE : undefined}
    >
      <g aria-hidden="true">
        {selected && (
          <circle r={radius + SELECTION_RING_OFFSET} fill="none" className="stroke-saffron" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6}>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={animDur} repeatCount="indefinite" />
          </circle>
        )}
        <circle
          r={radius}
          className={cn(
            'transition-all',
            selected ? 'fill-saffron' : meta.dot.replace('bg-', 'fill-'),
          )}
          stroke={onPath ? 'var(--saffron)' : 'var(--background)'}
          strokeWidth={onPath ? 3 : 2}
        />
        {showCore && (
          <circle r={radius * NODE_CORE_RATIO} fill="var(--background)" opacity={0.3} />
        )}
        {showLabel && (
          <text
            y={radius + LABEL_OFFSET_PX}
            textAnchor="middle"
            className={cn(
              'font-sans text-caption font-medium transition-colors',
              selected ? 'fill-ink' : 'fill-ink-soft',
            )}
          >
            {label}
          </text>
        )}
      </g>
    </g>
  )
}
