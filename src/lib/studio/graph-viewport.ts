import type { NodePosition } from './graph-layout'
import type { GraphNode } from './types'

/**
 * Canvas geometry for the graph view.
 *
 * The canvas the seed layout is authored on is 800×560, and the view used to
 * hard-code that as its viewBox. Placement, however, spreads unseeded nodes over
 * a band that grows with the library (`placementBand` in `graph-layout.ts`), and
 * the circular and hierarchical layouts lay nodes out on their own grid — both
 * can put nodes outside 800×560, where they are drawn off-canvas and cannot be
 * reached by panning either, because the viewBox never grows. The canvas is
 * therefore derived from the nodes it holds, and `zoom`/`panOffset` compose on
 * top of it, so resetting the view (Home) always shows the whole graph.
 */

/** Canvas the authored seed layout is drawn on; the canvas never shrinks below it. */
export const BASE_CANVAS_WIDTH = 800
export const BASE_CANVAS_HEIGHT = 560

/**
 * Half the width of a node label. Labels render at `text-caption` (10px) and
 * truncate at 24 characters, so one spans ~132px (the same measurement
 * `PREFERRED_NODE_DISTANCE_PX` is built on).
 */
const LABEL_HALF_WIDTH_PX = 66

/** Distance from a node centre to the bottom edge of its label, in px. */
const LABEL_BOTTOM_PX = 32

/** Breathing room between the outermost label and the canvas edge, in px. */
const CANVAS_MARGIN_PX = 16

/** Canvas dimensions in graph coordinates. */
export interface CanvasSize {
  width: number
  height: number
}

/** The base canvas, or the smallest canvas that contains every node and its label. */
export const canvasSize = (nodes: readonly GraphNode[]): CanvasSize => {
  let width = BASE_CANVAS_WIDTH
  let height = BASE_CANVAS_HEIGHT
  for (const node of nodes) {
    width = Math.max(width, node.x + LABEL_HALF_WIDTH_PX + CANVAS_MARGIN_PX)
    height = Math.max(height, node.y + LABEL_BOTTOM_PX + CANVAS_MARGIN_PX)
  }
  return { width, height }
}

/**
 * SVG `viewBox` for `size` at `zoom`, panned by `panOffset` (in viewport pixels).
 * Panning moves the view, so it is subtracted; zooming scales the box around the
 * canvas origin.
 */
export const canvasViewBox = (
  size: CanvasSize,
  zoom: number,
  panOffset: NodePosition,
): string =>
  `${-panOffset.x / zoom} ${-panOffset.y / zoom} ${size.width / zoom} ${size.height / zoom}`
