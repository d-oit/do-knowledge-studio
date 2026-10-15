import type { NodePosition } from './graph-layout'

/** Lowest zoom the canvas supports; matches the keyboard step's floor. */
export const MIN_ZOOM = 0.3

/** Highest zoom the canvas supports; matches the keyboard step's ceiling. */
export const MAX_ZOOM = 3

/** Largest pan offset accepted on restore/pan, in SVG units (5x the canvas). */
export const MAX_PAN = 4000

/** Pointer movement threshold in pixels before engaging drag pan (prevents tap misidentification). */
export const DRAG_PAN_SLOP_PX = 4

/** Zoom sensitivity factor per mouse wheel delta. */
export const WHEEL_ZOOM_SENSITIVITY = 0.0015

/** Constrains a value to an inclusive range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Calculates new pan offset when dragging by screen delta (dx, dy).
 * Screen displacement moves the viewBox in the opposite direction in graph space,
 * but panOffset is added to screen view, so adding dx / zoom preserves 1:1 motion.
 */
export const computeDragPanOffset = (
  currentPan: NodePosition,
  dx: number,
  dy: number,
): NodePosition => ({
  x: clamp(currentPan.x + dx, -MAX_PAN, MAX_PAN),
  y: clamp(currentPan.y + dy, -MAX_PAN, MAX_PAN),
})

/**
 * Computes zoom clamped to supported bounds.
 */
export const computeZoom = (currentZoom: number, deltaY: number): number => {
  const deltaFactor = -deltaY * WHEEL_ZOOM_SENSITIVITY
  const targetZoom = currentZoom * (1 + deltaFactor)
  return clamp(targetZoom, MIN_ZOOM, MAX_ZOOM)
}

/**
 * Computes focal zoom: zooms into or out of a specific screen coordinate (cursorX, cursorY)
 * relative to the SVG container element bounds.
 *
 * Given screen focal point F (relative to SVG top-left):
 * In SVG viewBox: X_graph = (F_x - pan_x) / zoom
 * Preserving graph coordinate under cursor after zoom change requires:
 * (F_x - pan_new) / zoom_new = (F_x - pan_old) / zoom_old
 * => F_x - pan_new = (F_x - pan_old) * (zoom_new / zoom_old)
 * => pan_new = F_x - (F_x - pan_old) * (zoom_new / zoom_old)
 */
export const computeFocalZoom = (
  currentZoom: number,
  newZoom: number,
  currentPan: NodePosition,
  focalPoint: NodePosition,
): { zoom: number; panOffset: NodePosition } => {
  if (currentZoom === newZoom) {
    return { zoom: currentZoom, panOffset: currentPan }
  }

  const zoomRatio = newZoom / currentZoom
  const newPanX = focalPoint.x - (focalPoint.x - currentPan.x) * zoomRatio
  const newPanY = focalPoint.y - (focalPoint.y - currentPan.y) * zoomRatio

  return {
    zoom: newZoom,
    panOffset: {
      x: clamp(newPanX, -MAX_PAN, MAX_PAN),
      y: clamp(newPanY, -MAX_PAN, MAX_PAN),
    },
  }
}
