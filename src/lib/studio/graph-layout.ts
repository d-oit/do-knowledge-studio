import type { Entity, GraphNode } from './types'
import { canvasSize, type CanvasSize } from './graph-viewport'
import { seedGraph } from './seed-data'
import type { GraphLayout } from './graph-snapshot'
import {
  clamp,
  placementBand,
  BASE_PLACEMENT_BAND,
  type PlacementBand,
  type ViewportSize,
} from './graph-placement-band'
export {
  PLACEMENT_X_MIN,
  PLACEMENT_X_MAX,
  PLACEMENT_Y_MIN,
  PLACEMENT_Y_MAX,
  BASE_BAND_ASPECT,
  BAND_ASPECT_MULTIPLIER_MIN,
  BAND_ASPECT_MULTIPLIER_MAX,
  BASE_BAND_CAPACITY,
} from './graph-placement-band'
export { placementBand, BASE_PLACEMENT_BAND, type PlacementBand, type ViewportSize }

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

/** Hash-derived position for an entity id, clamped into `band`. */
export const baseNodePosition = (
  id: string,
  band: PlacementBand = BASE_PLACEMENT_BAND,
): NodePosition => ({
  x: band.xMin + seededRandom(`${id}:x`) * (band.xMax - band.xMin),
  y: band.yMin + seededRandom(`${id}:y`) * (band.yMax - band.yMin),
})

/**
 * Uniform spatial hash over placed nodes.
 *
 * Placement used to scan every placed node for every probe, which is O(n²) in
 * the library size and made a 5k-node place take seconds (#1053). Clearance is
 * only ever tested against a fixed radius, so a grid with one preferred-spacing
 * cell answers the same question from a handful of buckets.
 */
interface NodeGrid {
  cells: Map<string, NodePosition[]>
}

/** Grid cell edge, in graph units: one preferred node spacing. */
const CLEARANCE_CELL_SIZE = PREFERRED_NODE_DISTANCE_PX

/** Cell key for a coordinate pair. */
const cellKey = (x: number, y: number): string =>
  `${Math.floor(x / CLEARANCE_CELL_SIZE)}:${Math.floor(y / CLEARANCE_CELL_SIZE)}`

/** Empty grid. */
const createGrid = (): NodeGrid => ({ cells: new Map() })

/** Inserts a placed position into its cell. */
const addToGrid = (grid: NodeGrid, position: NodePosition): void => {
  const key = cellKey(position.x, position.y)
  const bucket = grid.cells.get(key)
  if (bucket) bucket.push(position)
  else grid.cells.set(key, [position])
}

/**
 * Nodes that can be within `radius` of (x, y): every bucket the radius touches.
 * Cells outside that window cannot hold a closer node, so skipping them cannot
 * change a clearance decision.
 */
const nodesNear = (grid: NodeGrid, x: number, y: number, radius: number): NodePosition[] => {
  const minCellX = Math.floor((x - radius) / CLEARANCE_CELL_SIZE)
  const maxCellX = Math.floor((x + radius) / CLEARANCE_CELL_SIZE)
  const minCellY = Math.floor((y - radius) / CLEARANCE_CELL_SIZE)
  const maxCellY = Math.floor((y + radius) / CLEARANCE_CELL_SIZE)
  const near: NodePosition[] = []
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const bucket = grid.cells.get(`${cellX}:${cellY}`)
      if (bucket) near.push(...bucket)
    }
  }
  return near
}

/** Smallest squared distance from (x, y) to any neighbour; Infinity when none. */
const minClearanceSq = (x: number, y: number, near: readonly NodePosition[]): number => {
  let minSq = Number.POSITIVE_INFINITY
  for (const node of near) {
    const dx = node.x - x
    const dy = node.y - y
    const distSq = dx * dx + dy * dy
    if (distSq < minSq) {
      minSq = distSq
    }
  }
  return minSq
}

/**
 * Returns true if (x, y) is at least `minDistanceSq` away from every neighbour.
 * Early-exits on the first node closer than `minDistanceSq`.
 */
const hasMinClearanceSq = (
  x: number,
  y: number,
  near: readonly NodePosition[],
  minDistanceSq: number,
): boolean => {
  for (const node of near) {
    const dx = node.x - x
    const dy = node.y - y
    if (dx * dx + dy * dy < minDistanceSq) return false
  }
  return true
}

/** The `attempt`-th probe point around `base`, clamped into `band`. */
const probePosition = (base: NodePosition, attempt: number, band: PlacementBand): NodePosition => {
  const radius = PREFERRED_NODE_DISTANCE_PX * Math.sqrt(attempt)
  const angle = attempt * PROBE_ANGLE_RAD
  return {
    x: clamp(base.x + radius * Math.cos(angle), band.xMin, band.xMax),
    y: clamp(base.y + radius * Math.sin(angle), band.yMin, band.yMax),
  }
}

const PREFERRED_NODE_DISTANCE_SQ = PREFERRED_NODE_DISTANCE_PX * PREFERRED_NODE_DISTANCE_PX

/**
 * First probe point that keeps `minDistance` from every placed node, or null when
 * none of the probed candidates does.
 */
const probeForClearance = (
  base: NodePosition,
  grid: NodeGrid,
  minDistance: number,
  band: PlacementBand,
): NodePosition | null => {
  const minDistanceSq = minDistance * minDistance
  for (let attempt = 1; attempt <= PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = probePosition(base, attempt, band)
    const near = nodesNear(grid, candidate.x, candidate.y, minDistance)
    if (hasMinClearanceSq(candidate.x, candidate.y, near, minDistanceSq)) return candidate
  }
  return null
}

/**
 * Place a node from its id against the placement grid. The hash-derived base is
 * accepted when it already clears every placed node at the preferred spacing;
 * otherwise a deterministic golden-angle probe looks for a slot, first at the
 * preferred spacing and then at the click-safe one. Only a canvas too crowded
 * for both falls back to the candidate with the most clearance, so density
 * degrades legibility before it degrades click accuracy.
 */
const resolveWithGrid = (
  id: string,
  grid: NodeGrid,
  band: PlacementBand,
): NodePosition => {
  const base = baseNodePosition(id, band)
  let best = base
  let bestClearanceSq = minClearanceSq(
    base.x,
    base.y,
    nodesNear(grid, base.x, base.y, PREFERRED_NODE_DISTANCE_PX),
  )
  if (bestClearanceSq >= PREFERRED_NODE_DISTANCE_SQ) return best

  for (let attempt = 1; attempt <= PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = probePosition(base, attempt, band)
    const candidateClearanceSq = minClearanceSq(
      candidate.x,
      candidate.y,
      nodesNear(grid, candidate.x, candidate.y, PREFERRED_NODE_DISTANCE_PX),
    )
    if (candidateClearanceSq >= PREFERRED_NODE_DISTANCE_SQ) return candidate
    if (candidateClearanceSq > bestClearanceSq) {
      best = candidate
      bestClearanceSq = candidateClearanceSq
    }
  }

  return probeForClearance(base, grid, CLICK_SAFE_NODE_DISTANCE_PX, band) ?? best
}

/**
 * Place a node from its id against an explicit list of placed nodes.
 *
 * Builds a temporary grid, so callers that place many nodes should use
 * `placeGraphNodes` (which keeps one grid) instead of calling this per node.
 */
export const resolveNodePosition = (
  id: string,
  placed: readonly NodePosition[],
  band: PlacementBand = BASE_PLACEMENT_BAND,
): NodePosition => {
  const grid = createGrid()
  for (const position of placed) addToGrid(grid, position)
  return resolveWithGrid(id, grid, band)
}

const byEntityId = (a: Entity, b: Entity): number => a.id.localeCompare(b.id)

/**
 * Resolve every entity to a graph node. Entities with an authored seed position
 * keep it and act as fixed obstacles; the rest are placed in id order, so the
 * result does not depend on the library's sort order. The band the unseeded nodes
 * are placed in grows with their count, so a large library spreads out instead of
 * crowding into sub-click-safe gaps (see `placementBand`). `viewport` only
 * reshapes that band to the rendered canvas — the seed nodes never move, so the
 * authored layout keeps its positions at every viewport size.
 */
/**
 * Nodes placed per chunk. At the measured 5k rate (~455 ms total) a 250-node
 * chunk costs roughly 25 ms, which keeps one animation frame inside the
 * main-thread budget (#1053).
 */
export const PLACEMENT_CHUNK_SIZE = 250

/** Incremental placement state shared by the synchronous and chunked paths. */
export interface PlacementRunner {
  /** Positions resolved so far, in corpus order. */
  nodes: GraphNode[]
  /** Whether every entity has a position. */
  done: boolean
  /** Resolves the next chunk, or everything remaining when `all` is true. */
  placeChunk: (all?: boolean) => GraphNode[]
}

/**
 * Creates the incremental placer behind `placeGraphNodes`.
 *
 * Seed nodes are placed up front (they are authored coordinates, not work), and
 * unseeded nodes are resolved in deterministic id order — the same order the
 * synchronous path used, so chunk boundaries cannot change any final position.
 */
export const createPlacementRunner = (
  entities: readonly Entity[],
  seedNodes: readonly GraphNode[],
  viewport: ViewportSize | null = null,
  chunkSize: number = PLACEMENT_CHUNK_SIZE,
): PlacementRunner => {
  const seedMap = new Map(seedNodes.map((node) => [node.id, node]))
  const positions = new Map<string, NodePosition>()
  const grid = createGrid()

  for (const entity of entities) {
    const seed = seedMap.get(entity.id)
    if (!seed) continue
    const position = { x: seed.x, y: seed.y }
    positions.set(entity.id, position)
    addToGrid(grid, position)
  }

  const unseeded = entities.filter((entity) => !positions.has(entity.id)).sort(byEntityId)
  const band = placementBand(unseeded.length, viewport)
  const step = Math.max(1, Math.floor(chunkSize))
  let placedCount = 0

  const toNodes = (): GraphNode[] =>
    entities.flatMap((entity) => {
      const position = positions.get(entity.id)
      if (!position) return []
      return [{ id: entity.id, label: entity.name, type: entity.type, x: position.x, y: position.y }]
    })

  return {
    get nodes(): GraphNode[] {
      return toNodes()
    },
    get done(): boolean {
      return placedCount >= unseeded.length
    },
    placeChunk: (all = false): GraphNode[] => {
      const limit = all ? unseeded.length : Math.min(unseeded.length, placedCount + step)
      while (placedCount < limit) {
        const entity = unseeded[placedCount]
        if (entity === undefined) break
        const position = resolveWithGrid(entity.id, grid, band)
        positions.set(entity.id, position)
        addToGrid(grid, position)
        placedCount += 1
      }
      return toNodes()
    },
  }
}

/**
 * Resolve every entity to a graph node in one pass. See
 * `createPlacementRunner` for the incremental path a large corpus uses.
 */
export const placeGraphNodes = (
  entities: readonly Entity[],
  seedNodes: readonly GraphNode[],
  viewport: ViewportSize | null = null,
): GraphNode[] => createPlacementRunner(entities, seedNodes, viewport).placeChunk(true)

/** Centre and radius of the circular layout's ring, in canvas units. */
const CIRCULAR_CENTER: NodePosition = { x: 400, y: 280 }
const CIRCULAR_RADIUS = 200
/** Origin and per-cell step of the hierarchical layout's grid. */
const HIERARCHICAL_ORIGIN: NodePosition = { x: 120, y: 100 }
const HIERARCHICAL_STEP: NodePosition = { x: 180, y: 140 }

/**
 * Applies a layout algorithm's placement transform to already-placed nodes.
 * Shared by the graph view (which renders the result) and the snapshot restore
 * clamp (which needs the canvas a layout produces without rendering it).
 */
export const layoutNodes = (
  nodes: readonly GraphNode[],
  layout: GraphLayout,
): GraphNode[] => {
  if (layout === 'circular') {
    return nodes.map((n, i) => ({
      ...n,
      x: CIRCULAR_CENTER.x + CIRCULAR_RADIUS * Math.cos((2 * Math.PI * i) / nodes.length),
      y: CIRCULAR_CENTER.y + CIRCULAR_RADIUS * Math.sin((2 * Math.PI * i) / nodes.length),
    }))
  }
  if (layout === 'hierarchical') {
    const cols = Math.ceil(Math.sqrt(nodes.length))
    return nodes.map((n, i) => ({
      ...n,
      x: HIERARCHICAL_ORIGIN.x + (i % cols) * HIERARCHICAL_STEP.x,
      y: HIERARCHICAL_ORIGIN.y + Math.floor(i / cols) * HIERARCHICAL_STEP.y,
    }))
  }
  return [...nodes]
}

/**
 * The canvas a layout produces for the corpus. Restore uses the saved
 * snapshot's layout so a pan that was legal when saved is not re-clamped
 * against the currently displayed layout's canvas. The live viewport is passed
 * through so the bound matches the canvas the view is actually rendering.
 */
export const canvasForLayout = (
  entities: readonly Entity[],
  layout: GraphLayout,
  viewport: ViewportSize | null = null,
): CanvasSize => canvasSize(layoutNodes(placeGraphNodes(entities, seedGraph.nodes, viewport), layout))
