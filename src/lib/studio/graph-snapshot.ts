/**
 * Graph canvas snapshot persistence and revision comparison (Plan 157 & Plan 170).
 *
 * Provides a validated round-trip for graph canvas state, plus a pure diff engine
 * to compare live graph topologies against a stored snapshot without destructive mutation.
 *
 * Every read is validated (AGENTS.md: validate all external input at
 * boundaries) - localStorage is user-writable and survives deploys that
 * change the layout union, so an unvalidated parse would let a stale payload
 * crash the view.
 */
import { z } from 'zod'
import type { Entity } from './types'

/** localStorage key holding the saved graph canvas snapshot. */
export const GRAPH_SNAPSHOT_KEY = 'dks-graph-snapshot'

/** Layout algorithms the graph view can render. */
const LAYOUT_VALUES = ['force', 'circular', 'hierarchical'] as const

/** One of the graph layout algorithms. */
export type GraphLayout = (typeof LAYOUT_VALUES)[number]

/** One entity as captured inside a snapshot's topology payload. */
export interface SnapshotEntity {
  id: string
  name: string
}

/** One directional connection as captured inside a snapshot's topology payload. */
export interface SnapshotEdge {
  from: string
  to: string
}

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
  /** Entities present when the snapshot was taken (Plan 170). */
  entities?: SnapshotEntity[]
  /** Directional connections present when the snapshot was taken (Plan 170). */
  edges?: SnapshotEdge[]
}

/** Zod schema for the persisted snapshot payload. */
const GraphSnapshotSchema = z.object({
  layout: z.enum(LAYOUT_VALUES),
  selectedEntityId: z.string().nullable(),
  focusMode: z.boolean(),
  panX: z.number().finite(),
  panY: z.number().finite(),
  // `.positive()` still admits a zoom the canvas cannot render, and this
  // value is restored verbatim. Bound it to the range the view clamps to.
  zoom: z.number().finite().min(0.3).max(3),
  timestamp: z.string(),
  entities: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  edges: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
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
  const topology = entities
    ? {
        entities: entities.map((e) => ({ id: e.id, name: e.name })),
        edges: entities.flatMap((e) =>
          e.links.map((l) => ({ from: e.id, to: l.targetId })),
        ),
      }
    : { entities: undefined, edges: undefined }

  return {
    ...canvas,
    ...viewport,
    timestamp: new Date().toISOString(),
    ...topology,
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
    // A hand-edited or truncated entry is unusable - drop it so the next
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

/** An entity difference entry with a display name for the comparison dialog. */
export interface GraphEntityDelta {
  id: string
  name: string
}

/** A connection difference entry with both endpoint display names. */
export interface GraphEdgeDelta {
  from: string
  to: string
  fromName: string
  toName: string
}

/** Revision comparison difference between snapshot and live graph. */
export interface GraphSnapshotDiff {
  snapshotTimestamp: string
  layoutChanged: boolean
  previousLayout: GraphLayout
  currentLayout: GraphLayout
  focusModeChanged: boolean
  previousFocusMode: boolean
  currentFocusMode: boolean
  selectionChanged: boolean
  previousSelection: GraphEntityDelta | null
  currentSelection: GraphEntityDelta | null
  viewportChanged: boolean
  zoomDelta: number
  panDelta: { x: number; y: number }
  hasTopologyData: boolean
  addedEntities: GraphEntityDelta[]
  removedEntities: GraphEntityDelta[]
  retainedEntityCount: number
  addedEdges: GraphEdgeDelta[]
  removedEdges: GraphEdgeDelta[]
  retainedEdgeCount: number
}

/**
 * Canonical identity for a connection. JSON-encodes the endpoint pair so ids
 * containing the separator characters of any hand-rolled scheme (e.g. `a-b`
 * vs `a` + `b-c`) can never collapse into the same key.
 */
export const edgeIdentity = (edge: SnapshotEdge): string =>
  JSON.stringify([edge.from, edge.to])

/**
 * Pure diff engine: computes added/removed entities, edges, layout, viewport,
 * focus mode, and selection changes between a saved snapshot and the current
 * live graph state without modifying either.
 */
export const diffGraphSnapshot = (
  snapshot: GraphSnapshot,
  current: {
    layout: GraphLayout
    focusMode: boolean
    selectedEntityId: string | null
    zoom: number
    panOffset: { x: number; y: number }
    entities: readonly Entity[]
  },
): GraphSnapshotDiff => {
  const snapshotEntities = snapshot.entities ?? []
  const snapshotEdges = snapshot.edges ?? []
  // Gate each section on its own payload so a partially hand-edited entry
  // cannot silently suppress the deltas the surviving section can support.
  const hasEntityData = Boolean(snapshot.entities)
  const hasEdgeData = Boolean(snapshot.edges)
  const hasTopologyData = hasEntityData || hasEdgeData

  const liveNames = new Map(current.entities.map((e) => [e.id, e.name]))
  const snapshotNames = new Map(snapshotEntities.map((e) => [e.id, e.name]))
  /** Display name for an id: live corpus first, snapshot second, id last. */
  const nameOf = (id: string): string => liveNames.get(id) ?? snapshotNames.get(id) ?? id

  const liveIds = new Set(current.entities.map((e) => e.id))
  const snapshotIds = new Set(snapshotEntities.map((e) => e.id))

  /**
   * Deduplicates connections by canonical identity and drops links whose
   * endpoints are absent from the same corpus - the canvas never draws a
   * dangling link, so the comparison must not count one either.
   */
  const projectEdges = (
    edges: readonly SnapshotEdge[],
    ids: ReadonlySet<string>,
  ): SnapshotEdge[] => {
    const seen = new Map<string, SnapshotEdge>()
    for (const edge of edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) continue
      const key = edgeIdentity(edge)
      if (!seen.has(key)) seen.set(key, edge)
    }
    return [...seen.values()]
  }

  const liveEdges = projectEdges(
    current.entities.flatMap((e) => e.links.map((l) => ({ from: e.id, to: l.targetId }))),
    liveIds,
  )

  const addedEntities: GraphEntityDelta[] = []
  const removedEntities: GraphEntityDelta[] = []
  let retainedEntityCount = 0

  if (hasEntityData) {
    for (const entity of current.entities) {
      if (snapshotIds.has(entity.id)) {
        retainedEntityCount++
      } else {
        addedEntities.push({ id: entity.id, name: entity.name })
      }
    }
    for (const entity of snapshotEntities) {
      if (!liveIds.has(entity.id)) {
        removedEntities.push({ id: entity.id, name: entity.name })
      }
    }
  }

  const addedEdges: GraphEdgeDelta[] = []
  const removedEdges: GraphEdgeDelta[] = []
  let retainedEdgeCount = 0

  if (hasEdgeData) {
    const snapshotEdgeList = projectEdges(snapshotEdges, snapshotIds)
    const snapshotKeys = new Set(snapshotEdgeList.map(edgeIdentity))
    const liveKeys = new Set(liveEdges.map(edgeIdentity))

    for (const edge of liveEdges) {
      if (snapshotKeys.has(edgeIdentity(edge))) {
        retainedEdgeCount++
      } else {
        addedEdges.push({ ...edge, fromName: nameOf(edge.from), toName: nameOf(edge.to) })
      }
    }
    for (const edge of snapshotEdgeList) {
      if (!liveKeys.has(edgeIdentity(edge))) {
        removedEdges.push({ ...edge, fromName: nameOf(edge.from), toName: nameOf(edge.to) })
      }
    }
  }

  const layoutChanged = snapshot.layout !== current.layout
  const focusModeChanged = snapshot.focusMode !== current.focusMode
  // A schema-valid payload can hold an empty-string selection (the schema
  // accepts any string); normalize it to null so an empty id compares and
  // displays as the same "no selection" state on both sides.
  const previousSelectedId = snapshot.selectedEntityId === '' ? null : snapshot.selectedEntityId
  const currentSelectedId = current.selectedEntityId === '' ? null : current.selectedEntityId
  const selectionChanged = previousSelectedId !== currentSelectedId
  const previousSelection = previousSelectedId
    ? { id: previousSelectedId, name: nameOf(previousSelectedId) }
    : null
  const currentSelection = currentSelectedId
    ? { id: currentSelectedId, name: nameOf(currentSelectedId) }
    : null

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
    focusModeChanged,
    previousFocusMode: snapshot.focusMode,
    currentFocusMode: current.focusMode,
    selectionChanged,
    previousSelection,
    currentSelection,
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
