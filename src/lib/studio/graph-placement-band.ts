/** Placement band for unseeded graph nodes (extracted from graph-layout.ts, Plan 214 #1129). */

/** Canvas band that unseeded nodes are scattered over (mirrors the graph viewBox). */
export const PLACEMENT_X_MIN = 100
export const PLACEMENT_X_MAX = 700
export const PLACEMENT_Y_MIN = 80
export const PLACEMENT_Y_MAX = 480

/**
 * A rectangle in graph coordinates that unseeded nodes are placed inside.
 * Its AREA follows the library's size and its SHAPE follows the rendered
 * viewport (see `placementBand`).
 */
export interface PlacementBand {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** The unscaled band: 600×400 inside the 800×560 canvas the seed layout uses. */
export const BASE_PLACEMENT_BAND: PlacementBand = {
  xMin: PLACEMENT_X_MIN,
  xMax: PLACEMENT_X_MAX,
  yMin: PLACEMENT_Y_MIN,
  yMax: PLACEMENT_Y_MAX,
}

/**
 * The rendered viewport the band's shape adapts to, in CSS pixels. `null` — SSR,
 * the first paint before measurement, unit tests — keeps the authored 600×400
 * band exactly as it was.
 */
export interface ViewportSize {
  width: number
  height: number
}

/** Aspect ratio (width ÷ height) of the authored band: 600 ÷ 400. */
export const BASE_BAND_ASPECT =
  (PLACEMENT_X_MAX - PLACEMENT_X_MIN) / (PLACEMENT_Y_MAX - PLACEMENT_Y_MIN)

/**
 * How far the rendered viewport may reshape the band, as a multiplier of
 * `BASE_BAND_ASPECT`. The authored aspect is 1.5, so the band never gets
 * narrower than 0.75:1 nor wider than 3:1 no matter how extreme the window is —
 * that keeps an ultrawide or a very tall display from stretching the scatter
 * into a sliver while still letting a wide display hold the same library in a
 * shorter band.
 */
export const BAND_ASPECT_MULTIPLIER_MIN = 0.5
export const BAND_ASPECT_MULTIPLIER_MAX = 2

/**
 * Preferred-spacing slots the base band holds once the authored seed layout has
 * taken its share: (600×400 − 8 seed obstacles × ~17k px²) ÷ ~17k px² ≈ 6, where
 * 17k px² is one node's share of the plane at `PREFERRED_NODE_DISTANCE_PX` under
 * hexagonal packing. Exported because it is the band's first growth threshold.
 */
export const BASE_BAND_CAPACITY = 6

/** Per-tier growth: √2 per axis, so the band's area doubles each tier. */
const BAND_GROWTH_PER_TIER = Math.SQRT2

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** A band of the given size, anchored at the authored origin and growing right/down. */
const bandRect = (width: number, height: number): PlacementBand => ({
  xMin: BASE_PLACEMENT_BAND.xMin,
  yMin: BASE_PLACEMENT_BAND.yMin,
  xMax: BASE_PLACEMENT_BAND.xMin + width,
  yMax: BASE_PLACEMENT_BAND.yMin + height,
})

/** The viewport's aspect ratio, or null when there is no usable measurement. */
const measuredAspect = (viewport: ViewportSize | null): number | null => {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return null
  return viewport.width / viewport.height
}

/** `area` reshaped to `aspect` (width ÷ height), preserving the area exactly. */
const bandForAspect = (area: number, aspect: number): { width: number; height: number } => ({
  width: Math.sqrt(area * aspect),
  height: Math.sqrt(area / aspect),
})

/**
 * Placement band for `unseededCount` nodes. A band that holds only ~6 nodes at
 * the preferred spacing would otherwise crowd everything beyond that into
 * less-than-click-safe gaps — 40 new entities produced 42 such pairs, including
 * pairs with seed nodes, which is the wrong-entity selection plans/148 fixed.
 * The band therefore grows in tiers as the library does, and the graph canvas
 * grows with it (`canvasSize` in `graph-viewport.ts`) so no node leaves the
 * viewport.
 *
 * Growth is tiered, not continuous: the band's bounds change only when the count
 * crosses a tier, so the canvas grows in steps instead of rescaling on every
 * insert. Individual positions can still move when an entity is added, because
 * placement is sequential over a deterministic id order and every later node
 * probes against the ones already placed.
 *
 * `viewport` reshapes the band — its AREA, and with it the click-safe capacity,
 * is a function of `unseededCount` alone (plans/152 §6.1). A wide viewport asks
 * for the same area in a wide, short rectangle; a narrow one in a tall, narrow
 * one; the request is clamped to `BAND_ASPECT_MULTIPLIER_MIN/MAX`. Without a
 * measurement the authored 600×400 rectangle is returned bit-for-bit, because
 * the area-preserving reshape round-trips through `Math.sqrt` and would not
 * reproduce those exact doubles.
 */
export const placementBand = (
  unseededCount: number,
  viewport: ViewportSize | null = null,
): PlacementBand => {
  const tiers = Math.max(0, Math.ceil(Math.log2(Math.max(1, unseededCount) / BASE_BAND_CAPACITY)))
  const scale = BAND_GROWTH_PER_TIER ** tiers
  const authoredWidth = BASE_PLACEMENT_BAND.xMax - BASE_PLACEMENT_BAND.xMin
  const authoredHeight = BASE_PLACEMENT_BAND.yMax - BASE_PLACEMENT_BAND.yMin
  const aspect = measuredAspect(viewport)
  if (aspect === null) return bandRect(authoredWidth * scale, authoredHeight * scale)

  const multiplier = clamp(
    aspect / BASE_BAND_ASPECT,
    BAND_ASPECT_MULTIPLIER_MIN,
    BAND_ASPECT_MULTIPLIER_MAX,
  )
  const shaped = bandForAspect(
    authoredWidth * scale * authoredHeight * scale,
    BASE_BAND_ASPECT * multiplier,
  )
  return bandRect(shaped.width, shaped.height)
}

