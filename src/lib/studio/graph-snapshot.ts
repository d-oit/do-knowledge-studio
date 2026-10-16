/**
 * Graph canvas snapshot persistence and revision comparison (Plan 157 & Plan 170).
 *
 * Provides a validated round-trip for graph canvas state, plus a pure diff engine
 * to compare live graph topologies against a stored snapshot without destructive mutation.
 */
import { z } from 'zod'
import type { Entity } from './types'

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
  /** Set of entity IDs present when snapshot was taken (Plan 170). */
  entityIds?: string[]
  /** Set of edge connection keys ('sourceId-targetId') present when snapshot was taken (Plan 170). */
  edgeKeys?: string[]
}

/** Zod schema for the persisted snapshot payload. */
const GraphSnapshotSchema = z.object({
  layout: z.enum(LAYOUT_VALUES),
  selectedEntityId: z.string().nullable(),
  focusMode: z.boolean(),
  panX: z.number().finite(),
  panY: z.number().finite(),
  zoom: z.number().finite().min(0.3).max(3),
  timestamp: z.string(),
  entityIds: z.array(z.string()).optional(),
  edgeKeys: z.array(z.string()).optional(),
})

/** Canvas viewport transform captured alongside the layout state. */
export interface GraphViewportState {
  panX: number
  panY: number
  zoom: number
}

/** Builds a snapshot from the live canvas state and current entities. */
export const buildGraphSnapshot = (
  canvas: { layout: GraphLayout; selectedEntityId: string | null; focusMode: boolean },
  viewport: GraphViewportState,
  entities?: readonly Entity[],
): GraphSnapshot => {
  const entityIds = entities ? entities.map((e) => e.id) : undefined
  const edgeKeys = entities
    ? entities.flatMap((e) => e.links.map((l) => `${e.id}-${l.targetId}`))
    : undefined

  return {
    ...canvas,
    ...viewport,
    timestamp: new Date().toISOString(),
    entityIds,
    edgeKeys,
  }
}

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

/** Revision comparison difference between snapshot and live graph. */
export interface GraphSnapshotDiff {
  snapshotTimestamp: string
  layoutChanged: boolean
  previousLayout: GraphLayout
  currentLayout: GraphLayout
  viewportChanged: boolean
  zoomDelta: number
  panDelta: { x: number; y: number }
  hasTopologyData: boolean
  addedEntities: string[]
  removedEntities: string[]
  retainedEntityCount: number
  addedEdges: string[]
  removedEdges: string[]
  retainedEdgeCount: number
}

/**
 * Pure diff engine: computes added/removed entities, edges, layout, and viewport changes
 * between a saved snapshot and the current live graph state without modifying either.
 */
export const diffGraphSnapshot = (
  snapshot: GraphSnapshot,
  current: {
    layout: GraphLayout
    zoom: number
    panOffset: { x: number; y: number }
    entities: readonly Entity[]
  },
): GraphSnapshotDiff => {
  const currentEntityMap = new Map(current.entities.map((e) => [e.id, e.name]))
  const currentEntityIds = new Set(current.entities.map((e) => e.id))
  const currentEdgeKeys = new Set(
    current.entities.flatMap((e) => e.links.map((l) => `${e.id}-${l.targetId}`)),
  )

  const hasTopologyData = Boolean(snapshot.entityIds && snapshot.edgeKeys)
  const snapshotEntityIds = new Set(snapshot.entityIds ?? [])
  const snapshotEdgeKeys = new Set(snapshot.edgeKeys ?? [])

  const addedEntities: string[] = []
  const removedEntities: string[] = []
  let retainedEntityCount = 0

  if (hasTopologyData) {
    for (const id of currentEntityIds) {
      if (snapshotEntityIds.has(id)) {
        retainedEntityCount++
      } else {
        addedEntities.push(currentEntityMap.get(id) ?? id)
      }
    }
    for (const id of snapshotEntityIds) {
      if (!currentEntityIds.has(id)) {
        removedEntities.push(id)
      }
    }
  }

  const addedEdges: string[] = []
  const removedEdges: string[] = []
  let retainedEdgeCount = 0

  if (hasTopologyData) {
    for (const key of currentEdgeKeys) {
      if (snapshotEdgeKeys.has(key)) {
        retainedEdgeCount++
      } else {
        addedEdges.push(key)
      }
    }
    for (const key of snapshotEdgeKeys) {
      if (!currentEdgeKeys.has(key)) {
        removedEdges.push(key)
      }
    }
  }

  const layoutChanged = snapshot.layout !== current.layout
  const zoomDelta = current.zoom - snapshot.zoom
  const panDelta = {
    x: current.panOffset.x - snapshot.panX,
    y: current.panOffset.y - snapshot.panY,
  }
  const viewportChanged =
    Math.abs(zoomDelta) > 0.001 || Math.abs(panDelta.x) > 0.5 || Math.abs(panDelta.y) > 0.5

  return {
    snapshotTimestamp: snapshot.timestamp,
    layoutChanged,
    previousLayout: snapshot.layout,
    currentLayout: current.layout,
    viewportChanged,
    zoomDelta,
    panDelta,
    hasTopologyData,
    addedEntities,
    removedEntities,
    retainedEntityCount,
    addedEdges,
    removedEdges,
    retainedEdgeCount,
  }
}
