import type { NodePosition } from './graph-layout'
import type { CanvasSize } from './graph-viewport'

/** Lowest zoom the canvas supports; matches the keyboard step's floor. */
export const MIN_ZOOM = 0.3

/** Highest zoom the canvas supports; matches the keyboard step's ceiling. */
export const MAX_ZOOM = 3

/** Largest default pan limit, in SVG units. */
export const MAX_PAN = 4000
export const DEFAULT_MAX_PAN = MAX_PAN

/** Pointer movement threshold in pixels before engaging drag pan (prevents tap misidentification). */
export const DRAG_PAN_SLOP_PX = 4

/** Zoom sensitivity factor per mouse wheel delta. */
export const WHEEL_ZOOM_SENSITIVITY = 0.0015

/** Swipe detection distance threshold for Mind Map node disclosure gestures (in px). */
export const MINDMAP_SWIPE_THRESHOLD_PX = 64

/** Minimum touch target size for interactive controls in px (WCAG 2.5.5). */
export const MIN_TOUCH_TARGET_SIZE_PX = 44

/** Constrains a value to an inclusive range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Calculates dynamic max pan bound based on canvas size and zoom level,
 * ensuring any node placed within the dynamic canvas band can be panned into view.
 */
export const computeMaxPan = (canvas?: CanvasSize, zoom = 1): number => {
  if (!canvas) return DEFAULT_MAX_PAN
  const maxDim = Math.max(canvas.width, canvas.height)
  return Math.max(DEFAULT_MAX_PAN, maxDim * zoom * 3)
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
 * Converts a client-space displacement (dxClient, dyClient) into panOffset delta.
 * `canvasViewBox` computes viewBox origin as `-panOffset / zoom`.
 * To achieve 1:1 direct tracking under the cursor:
 * Screen displacement dx moves the viewBox in graph units by `dx * clientToViewBoxScale`.
 * Since minX = -panOffset.x / zoom, moving graph right means minX decreases,
 * so -panOffset.x / zoom decreases by (dx * clientToViewBoxScale),
 * which requires delta(panOffset.x) = dx * clientToViewBoxScale * zoom.
 */
export const computeDragPanOffset = (
  currentPan: NodePosition,
  dxClient: number,
  dyClient: number,
  clientToViewBoxScale = 1,
  zoom = 1,
  canvas?: CanvasSize,
): NodePosition => {
  const maxPan = computeMaxPan(canvas, zoom)
  const panDeltaX = dxClient * clientToViewBoxScale * zoom
  const panDeltaY = dyClient * clientToViewBoxScale * zoom
  return {
    x: clamp(currentPan.x + panDeltaX, -maxPan, maxPan),
    y: clamp(currentPan.y + panDeltaY, -maxPan, maxPan),
  }
}

/**
 * Computes zoom clamped to supported bounds.
 */
export const computeZoom = (currentZoom: number, deltaY: number): number => {
  const deltaFactor = -deltaY * WHEEL_ZOOM_SENSITIVITY
  const targetZoom = currentZoom * (1 + deltaFactor)
  return clamp(targetZoom, MIN_ZOOM, MAX_ZOOM)
}

/**
 * Computes Euclidean distance between two pointers.
 */
export const computePointerDistance = (p1: NodePosition, p2: NodePosition): number =>
  Math.hypot(p2.x - p1.x, p2.y - p1.y)

/**
 * Computes midpoint between two pointers.
 */
export const computePointerMidpoint = (p1: NodePosition, p2: NodePosition): NodePosition => ({
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2,
})

/**
 * Computes pinch zoom and midpoint pan for dual-touch interaction.
 */
export const computePinchGesture = (
  initialDistance: number,
  currentDistance: number,
  initialMidpoint: NodePosition,
  currentMidpoint: NodePosition,
  initialZoom: number,
  initialPan: NodePosition,
  canvas: CanvasSize,
  clientRect: { width: number; height: number },
): { zoom: number; panOffset: NodePosition } => {
  if (initialDistance <= 0 || currentDistance <= 0) {
    return { zoom: initialZoom, panOffset: initialPan }
  }

  const scaleRatio = currentDistance / initialDistance
  const targetZoom = clamp(initialZoom * scaleRatio, MIN_ZOOM, MAX_ZOOM)

  // Zoom around initial midpoint
  const zoomed = computeFocalZoom(
    initialZoom,
    targetZoom,
    initialPan,
    canvas,
    initialMidpoint,
    clientRect,
  )

  // Translate pan by midpoint movement
  const midDeltaX = currentMidpoint.x - initialMidpoint.x
  const midDeltaY = currentMidpoint.y - initialMidpoint.y
  const clientScale = getClientToViewBoxScale(canvas, targetZoom, clientRect)

  const panned = computeDragPanOffset(
    zoomed.panOffset,
    midDeltaX,
    midDeltaY,
    clientScale,
    targetZoom,
    canvas,
  )

  return {
    zoom: targetZoom,
    panOffset: panned,
  }
}

/**
 * Computes focal zoom: adjusts zoom and panOffset so that the graph coordinate
 * currently under the cursor (focalClient relative to SVG bounding box)
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

  // Pre-zoom viewBox dimensions and letterboxing
  const vbW0 = canvas.width / currentZoom
  const vbH0 = canvas.height / currentZoom
  const scale0 = Math.max(vbW0 / clientRect.width, vbH0 / clientRect.height)
  const renderedW0 = vbW0 / scale0
  const renderedH0 = vbH0 / scale0
  const offsetX0 = (clientRect.width - renderedW0) / 2
  const offsetY0 = (clientRect.height - renderedH0) / 2

  // Graph point under cursor prior to zoom
  const graphX = -currentPan.x / currentZoom + (focalClient.x - offsetX0) * scale0
  const graphY = -currentPan.y / currentZoom + (focalClient.y - offsetY0) * scale0

  // Post-zoom viewBox dimensions and letterboxing
  const vbW1 = canvas.width / newZoom
  const vbH1 = canvas.height / newZoom
  const scale1 = Math.max(vbW1 / clientRect.width, vbH1 / clientRect.height)
  const renderedW1 = vbW1 / scale1
  const renderedH1 = vbH1 / scale1
  const offsetX1 = (clientRect.width - renderedW1) / 2
  const offsetY1 = (clientRect.height - renderedH1) / 2

  // Solve for panOffset such that graph point remains under focalClient
  const newPanX = -newZoom * (graphX - (focalClient.x - offsetX1) * scale1)
  const newPanY = -newZoom * (graphY - (focalClient.y - offsetY1) * scale1)

  const maxPan = computeMaxPan(canvas, newZoom)
  return {
    zoom: newZoom,
    panOffset: {
      x: clamp(newPanX, -maxPan, maxPan),
      y: clamp(newPanY, -maxPan, maxPan),
    },
  }
}
