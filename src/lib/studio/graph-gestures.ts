import type { NodePosition } from './graph-layout'
import type { CanvasSize } from './graph-viewport'

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

export interface SvgViewportMetrics {
  viewBox: { x: number; y: number; width: number; height: number }
  clientRect: { left: number; top: number; width: number; height: number }
}

/**
 * Calculates the scale factor converting client (CSS) pixels into SVG viewBox/canvas units.
 * For `preserveAspectRatio="xMidYMid meet"`, uniform scale is used:
 * scale = viewBox.width / viewBox.height > clientRect.width / clientRect.height
 *   ? viewBox.width / clientRect.width
 *   : viewBox.height / clientRect.height
 */
export const getClientToViewBoxScale = (
  canvas: CanvasSize,
  zoom: number,
  clientRect: { width: number; height: number },
): number => {
  if (clientRect.width <= 0 || clientRect.height <= 0) return 1
  const viewBoxWidth = canvas.width / zoom
  const viewBoxHeight = canvas.height / zoom
  const viewBoxAspect = viewBoxWidth / viewBoxHeight
  const clientAspect = clientRect.width / clientRect.height

  return viewBoxAspect > clientAspect
    ? viewBoxWidth / clientRect.width
    : viewBoxHeight / clientRect.height
}

/**
 * Converts a client-space displacement (screen delta) into canvas pan offset delta.
 * Panning translates panOffset, which moves the viewBox origin in graph space:
 * minX = -panOffset.x / zoom
 * A screen movement of dx (mouse moves right) moves graph content right, so panOffset.x increases.
 * 1 client pixel = clientToCanvasScale canvas units.
 */
export const computeDragPanOffset = (
  currentPan: NodePosition,
  dxClient: number,
  dyClient: number,
  clientToCanvasScale = 1,
): NodePosition => ({
  x: clamp(currentPan.x + dxClient * clientToCanvasScale, -MAX_PAN, MAX_PAN),
  y: clamp(currentPan.y + dyClient * clientToCanvasScale, -MAX_PAN, MAX_PAN),
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
 * Computes focal zoom: adjusts zoom and panOffset so that the graph position
 * currently under the cursor (focalPointClient relative to SVG bounding box)
 * remains stationary under the cursor after zooming.
 */
export const computeFocalZoom = (
  currentZoom: number,
  newZoom: number,
  currentPan: NodePosition,
  canvas: CanvasSize,
  focalClient: NodePosition,
  clientRect: { width: number; height: number },
): { zoom: number; panOffset: NodePosition } => {
  if (currentZoom === newZoom || clientRect.width <= 0 || clientRect.height <= 0) {
    return { zoom: currentZoom, panOffset: currentPan }
  }

  // Active viewBox dimensions
  const vbW0 = canvas.width / currentZoom
  const vbH0 = canvas.height / currentZoom

  // Uniform scale and letterboxing offsets for xMidYMid meet
  const scale0 = Math.max(vbW0 / clientRect.width, vbH0 / clientRect.height)
  const renderedW0 = vbW0 / scale0
  const renderedH0 = vbH0 / scale0
  const offsetX0 = (clientRect.width - renderedW0) / 2
  const offsetY0 = (clientRect.height - renderedH0) / 2

  // Graph point under cursor prior to zoom
  const graphX = -currentPan.x / currentZoom + (focalClient.x - offsetX0) * scale0
  const graphY = -currentPan.y / currentZoom + (focalClient.y - offsetY0) * scale0

  // Post-zoom viewBox dimensions
  const vbW1 = canvas.width / newZoom
  const vbH1 = canvas.height / newZoom
  const scale1 = Math.max(vbW1 / clientRect.width, vbH1 / clientRect.height)
  const renderedW1 = vbW1 / scale1
  const renderedH1 = vbH1 / scale1
  const offsetX1 = (clientRect.width - renderedW1) / 2
  const offsetY1 = (clientRect.height - renderedH1) / 2

  // Solve for panOffset such that graph point remains under focalClient:
  // graphX = -newPan.x / newZoom + (focalClient.x - offsetX1) * scale1
  // => newPan.x = -newZoom * (graphX - (focalClient.x - offsetX1) * scale1)
  const newPanX = -newZoom * (graphX - (focalClient.x - offsetX1) * scale1)
  const newPanY = -newZoom * (graphY - (focalClient.y - offsetY1) * scale1)

  return {
    zoom: newZoom,
    panOffset: {
      x: clamp(newPanX, -MAX_PAN, MAX_PAN),
      y: clamp(newPanY, -MAX_PAN, MAX_PAN),
    },
  }
}
