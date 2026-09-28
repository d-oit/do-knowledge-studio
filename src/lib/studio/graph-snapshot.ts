/**
 * Graph canvas snapshot persistence (Plan 157 Phase 1, closes D4.1).
 *
 * The graph toolbar wrote a `dks-graph-snapshot` blob that nothing ever read
 * back. This module owns the whole round-trip: a validated read/write pair
 * for the canvas state (layout, selection, focus mode, and viewport), so
 * "Save snapshot" and "Restore snapshot" are one symmetric feature.
 *
 * Every read is validated (AGENTS.md: validate all external input at
 * boundaries) — localStorage is user-writable and survives deploys that
 * change the layout union, so an unvalidated parse would let a stale payload
 * crash the view.
 */
import { z } from 'zod'

/** localStorage key holding the saved graph canvas snapshot. */
export const GRAPH_SNAPSHOT_KEY = 'dks-graph-snapshot'

/** Layout algorithms the graph view can render. */
const LAYOUT_VALUES = ['force', 'circular', 'hierarchical'] as const

/** One of the graph layout algorithms. */
export type GraphLayout = (typeof LAYOUT_VALUES)[number]

/** Canvas state captured by a snapshot. */
export interface GraphSnapshot {
  /** Active node layout algorithm. */
  layout: GraphLayout
  /** Entity highlighted as selected, or null when nothing is selected. */
  selectedEntityId: string | null
  /** Whether the neighborhood filter was engaged. */
  focusMode: boolean
  /** Horizontal canvas pan in SVG units. */
  panX: number
  /** Vertical canvas pan in SVG units. */
  panY: number
  /** Canvas zoom factor. */
  zoom: number
  /** ISO timestamp of the moment the snapshot was taken. */
  timestamp: string
}

/** Zod schema for the persisted snapshot payload. */
const GraphSnapshotSchema = z.object({
  layout: z.enum(LAYOUT_VALUES),
  selectedEntityId: z.string().nullable(),
  focusMode: z.boolean(),
  panX: z.number().finite(),
  panY: z.number().finite(),
  zoom: z.number().finite().positive(),
  timestamp: z.string(),
})

/** Canvas viewport transform captured alongside the layout state. */
export interface GraphViewportState {
  panX: number
  panY: number
  zoom: number
}

/** Builds a snapshot from the live canvas state. */
export const buildGraphSnapshot = (
  canvas: { layout: GraphLayout; selectedEntityId: string | null; focusMode: boolean },
  viewport: GraphViewportState,
): GraphSnapshot => ({
  ...canvas,
  ...viewport,
  timestamp: new Date().toISOString(),
})

/** Persists a snapshot. Returns false when storage rejects the write. */
export const saveGraphSnapshot = (snapshot: GraphSnapshot): boolean => {
  try {
    localStorage.setItem(GRAPH_SNAPSHOT_KEY, JSON.stringify(snapshot))
    return true
  } catch (error) {
    console.error('Failed to save graph snapshot:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Reads and validates the stored snapshot. A missing, unparseable, or
 * schema-mismatched payload returns null (and is cleared when it is
 * unusable) so a corrupt entry can never wedge the restore button.
 */
export const readGraphSnapshot = (): GraphSnapshot | null => {
  let raw: string | null
  try {
    raw = localStorage.getItem(GRAPH_SNAPSHOT_KEY)
  } catch (error) {
    console.error('Failed to read graph snapshot:', error instanceof Error ? error.message : error)
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // A hand-edited or truncated entry is unusable — drop it so the next
    // save starts from a clean slot.
    clearGraphSnapshot()
    return null
  }

  const result = GraphSnapshotSchema.safeParse(parsed)
  if (!result.success) {
    clearGraphSnapshot()
    return null
  }
  return result.data
}

/** Removes the stored snapshot. */
export const clearGraphSnapshot = (): void => {
  try {
    localStorage.removeItem(GRAPH_SNAPSHOT_KEY)
  } catch (error) {
    console.error('Failed to clear graph snapshot:', error instanceof Error ? error.message : error)
  }
}
