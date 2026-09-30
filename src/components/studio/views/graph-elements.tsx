'use client'

import { type GraphEdge, type GraphNode } from '@/lib/studio/types'
import { cn } from '@/lib/utils'

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
}: {
  edge: GraphEdge
  sourceNode: GraphNode
  targetNode: GraphNode
  selectedEntityId: string | null
}) => {
  const isHighlighted = isEdgeHighlighted(edge, selectedEntityId)
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
      {isHighlighted && (
        <EdgeRelationLabel
          sourceNode={sourceNode}
          targetNode={targetNode}
          relation={edge.relation}
        />
      )}
    </g>
  )
}
