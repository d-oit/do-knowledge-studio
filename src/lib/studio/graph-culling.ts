/**
 * Viewport culling and level-of-detail for the graph canvas (#1053).
 *
 * The SVG canvas draws whatever it is given, so a large library paid for every
 * node and edge on every frame — including the ones outside the viewBox. These
 * helpers are pure: they take the graph-space rectangle the viewBox shows and
 * return only what can be seen, plus the label rules for the current zoom.
 */
import type { GraphEdge, GraphNode } from './types'
import type { CanvasSize } from './graph-viewport'
import type { NodePosition } from './graph-layout'

/** A rectangle in graph (viewBox) coordinates. */
export interface GraphRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Extra graph units drawn beyond the viewBox edge: a node whose dot is off the
 * edge but whose label still reaches into the view must not pop in and out.
 */
export const CULL_MARGIN_PX = 120

/** Node count above which labels become zoom-dependent (level of detail). */
export const LABEL_LOD_NODE_THRESHOLD = 400

/** Zoom at or above which a large graph still draws node labels. */
export const LABEL_LOD_MIN_ZOOM = 0.6

/** Zoom at or above which a large graph still draws relation labels. */
export const EDGE_LABEL_MIN_ZOOM = 1.2

/** Node count above which the view reports that it is degrading rendering. */
export const LARGE_GRAPH_NOTICE_THRESHOLD = 1000

/**
 * The graph-space rectangle a viewBox shows.
 * @param size - Canvas size in graph units.
 * @param zoom - Current zoom factor.
 * @param panOffset - Pan in viewport pixels (subtracted, as in `canvasViewBox`).
 * @returns The visible rectangle, matching the SVG viewBox maths exactly.
 */
export const viewBoxRect = (
  size: CanvasSize,
  zoom: number,
  panOffset: NodePosition,
): GraphRect => ({
  x: -panOffset.x / zoom,
  y: -panOffset.y / zoom,
  width: size.width / zoom,
  height: size.height / zoom,
})

/** Whether a point lies inside `rect` grown by `margin` on every side. */
const contains = (rect: GraphRect, x: number, y: number, margin: number): boolean =>
  x >= rect.x - margin &&
  x <= rect.x + rect.width + margin &&
  y >= rect.y - margin &&
  y <= rect.y + rect.height + margin

/**
 * Nodes that can be seen through the viewBox, preserving input order.
 * @param nodes - Positioned nodes.
 * @param rect - Visible rectangle in graph units.
 * @param margin - Extra graph units kept on every side.
 * @returns The drawable subset.
 */
export const cullNodes = (
  nodes: readonly GraphNode[],
  rect: GraphRect,
  margin: number = CULL_MARGIN_PX,
): GraphNode[] => nodes.filter((node) => contains(rect, node.x, node.y, margin))

/**
 * Edges whose two endpoints are both drawable. A half-offscreen edge would
 * otherwise be drawn to a node that is not rendered.
 * @param edges - Candidate edges.
 * @param drawableIds - Ids of the nodes being drawn.
 * @returns The drawable subset, preserving input order.
 */
export const cullEdges = (
  edges: readonly GraphEdge[],
  drawableIds: ReadonlySet<string>,
): GraphEdge[] =>
  edges.filter((edge) => drawableIds.has(edge.source) && drawableIds.has(edge.target))

/**
 * Whether node labels should be drawn at this size and zoom.
 * Small graphs keep labels at every zoom; large ones drop them when zoomed out,
 * where they would overlap into an unreadable smear anyway.
 */
export const shouldShowNodeLabels = (nodeCount: number, zoom: number): boolean =>
  nodeCount < LABEL_LOD_NODE_THRESHOLD || zoom >= LABEL_LOD_MIN_ZOOM

/** Whether relation labels should be drawn for highlighted edges. */
export const shouldShowRelationLabels = (nodeCount: number, zoom: number): boolean =>
  nodeCount < LABEL_LOD_NODE_THRESHOLD || zoom >= EDGE_LABEL_MIN_ZOOM

/** Whether the graph is large enough to warrant the degradation notice. */
export const isLargeGraph = (nodeCount: number): boolean => nodeCount >= LARGE_GRAPH_NOTICE_THRESHOLD
