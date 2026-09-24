import type { Entity, GraphNode } from './types'

/**
 * Deterministic placement for graph nodes that have no authored position.
 *
 * Entity ids are random UUIDs, so hashing an id straight into the canvas can drop
 * a node underneath an existing node's label. SVG gives a click to the topmost
 * element, so that label swallows clicks aimed at the dot beneath it and selects
 * the wrong entity — reproduced as a flake by the `editor-mentions` E2E test
 * (plans/148). Placement therefore probes for a free slot instead of accepting
 * the first hash-derived point.
 */

/**
 * Deterministic hash → [0, 1) float for stable graph node positions.
 * Replaces Math.random() so the layout does not shuffle on every render.
 */
export const seededRandom = (seed: string): number => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  // Mix the bits for better distribution, then scale to [0, 1)
  return (Math.abs((hash * 2654435761) >>> 0) % 10_000) / 10_000
}

/** Canvas band that unseeded nodes are scattered over (mirrors the graph viewBox). */
export const PLACEMENT_X_MIN = 100
export const PLACEMENT_X_MAX = 700
export const PLACEMENT_Y_MIN = 80
export const PLACEMENT_Y_MAX = 480

/**
 * Preferred centre-to-centre distance between two placed nodes. Labels render at
 * `text-caption` (10px) and truncate at 24 characters, so one spans ~132px; at
 * this spacing two labels no longer overlap at the same height. Seed nodes sit
 * 150–400px apart, so it stays in character with the authored layout.
 */
export const PREFERRED_NODE_DISTANCE_PX = 140

/**
 * Distance below which one node's label can cover a neighbour's dot and steal
 * its clicks. A click lands at the centre of the node's bounding box — the dot
 * plus its label, i.e. ~10px below the centre — and a label occupies the band
 * 15–30px below its own centre, half-width ~66px. Interception therefore needs
 * `4.5 <= Δy <= 19.5` and `|Δx| <= 66`, whose largest possible separation is
 * `hypot(66, 19.5) ≈ 68.8`; 80 keeps a margin. Placement falls back to this
 * spacing when the canvas is too crowded for the preferred one, and never
 * returns a position closer than the best-effort probe below that.
 */
export const CLICK_SAFE_NODE_DISTANCE_PX = 80

/** Probe offsets tried per spacing tier before the next tier is attempted. */
const PLACEMENT_ATTEMPTS = 32
/** Golden-angle turn (radians) so successive probes spread around the origin. */
const PROBE_ANGLE_RAD = 2.399963229728653

/** A point in graph coordinates. */
export interface NodePosition {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** Hash-derived position for an entity id, clamped into the placement band. */
export const baseNodePosition = (id: string): NodePosition => ({
  x: PLACEMENT_X_MIN + seededRandom(`${id}:x`) * (PLACEMENT_X_MAX - PLACEMENT_X_MIN),
  y: PLACEMENT_Y_MIN + seededRandom(`${id}:y`) * (PLACEMENT_Y_MAX - PLACEMENT_Y_MIN),
})

/** Smallest distance from (x, y) to any placed node; Infinity when none are placed. */
const clearance = (x: number, y: number, placed: readonly NodePosition[]): number =>
  placed.reduce(
    (min, node) => Math.min(min, Math.hypot(node.x - x, node.y - y)),
    Number.POSITIVE_INFINITY,
  )

/** The `attempt`-th probe point around `base`, clamped into the placement band. */
const probePosition = (base: NodePosition, attempt: number): NodePosition => {
  const radius = PREFERRED_NODE_DISTANCE_PX * Math.sqrt(attempt)
  const angle = attempt * PROBE_ANGLE_RAD
  return {
    x: clamp(base.x + radius * Math.cos(angle), PLACEMENT_X_MIN, PLACEMENT_X_MAX),
    y: clamp(base.y + radius * Math.sin(angle), PLACEMENT_Y_MIN, PLACEMENT_Y_MAX),
  }
}

/**
 * First probe point that keeps `minDistance` from every placed node, or null when
 * none of the probed candidates does.
 */
const probeForClearance = (
  base: NodePosition,
  placed: readonly NodePosition[],
  minDistance: number,
): NodePosition | null => {
  for (let attempt = 1; attempt <= PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = probePosition(base, attempt)
    if (clearance(candidate.x, candidate.y, placed) >= minDistance) return candidate
  }
  return null
}

/**
 * Place a node from its id. The hash-derived base is accepted when it already
 * clears every placed node at the preferred spacing; otherwise a deterministic
 * golden-angle probe looks for a slot, first at the preferred spacing and then at
 * the click-safe one. Only a canvas too crowded for both falls back to the
 * candidate with the most clearance, so density degrades legibility before it
 * degrades click accuracy.
 */
export const resolveNodePosition = (
  id: string,
  placed: readonly NodePosition[],
): NodePosition => {
  const base = baseNodePosition(id)
  let best = base
  let bestClearance = clearance(base.x, base.y, placed)
  if (bestClearance >= PREFERRED_NODE_DISTANCE_PX) return best

  for (let attempt = 1; attempt <= PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = probePosition(base, attempt)
    const candidateClearance = clearance(candidate.x, candidate.y, placed)
    if (candidateClearance >= PREFERRED_NODE_DISTANCE_PX) return candidate
    if (candidateClearance > bestClearance) {
      best = candidate
      bestClearance = candidateClearance
    }
  }

  return probeForClearance(base, placed, CLICK_SAFE_NODE_DISTANCE_PX) ?? best
}

const byEntityId = (a: Entity, b: Entity): number => a.id.localeCompare(b.id)

/**
 * Resolve every entity to a graph node. Entities with an authored seed position
 * keep it and act as fixed obstacles; the rest are placed in id order, so the
 * result does not depend on the library's sort order.
 */
export const placeGraphNodes = (
  entities: readonly Entity[],
  seedNodes: readonly GraphNode[],
): GraphNode[] => {
  const seedMap = new Map(seedNodes.map((node) => [node.id, node]))
  const positions = new Map<string, NodePosition>()
  const placed: NodePosition[] = []

  for (const entity of entities) {
    const seed = seedMap.get(entity.id)
    if (!seed) continue
    positions.set(entity.id, { x: seed.x, y: seed.y })
    placed.push({ x: seed.x, y: seed.y })
  }

  const unseeded = entities.filter((entity) => !positions.has(entity.id)).sort(byEntityId)
  for (const entity of unseeded) {
    const position = resolveNodePosition(entity.id, placed)
    positions.set(entity.id, position)
    placed.push(position)
  }

  return entities.flatMap((entity) => {
    const position = positions.get(entity.id)
    if (!position) return []
    return [{ id: entity.id, label: entity.name, type: entity.type, x: position.x, y: position.y }]
  })
}
