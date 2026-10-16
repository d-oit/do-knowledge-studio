'use client'

import { useCallback, useState } from 'react'
import {
  buildGraphSnapshot,
  clearGraphSnapshot,
  diffGraphSnapshot,
  readGraphSnapshot,
  saveGraphSnapshot,
  type GraphLayout,
  type GraphSnapshotDiff,
} from '@/lib/studio/graph-snapshot'
import { clamp, computeMaxPan, MAX_ZOOM, MIN_ZOOM } from '@/lib/studio/graph-gestures'
import type { CanvasSize } from '@/lib/studio/graph-viewport'
import type { Entity } from '@/lib/studio/types'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'

interface GraphSnapshotComparisonParams {
  layout: GraphLayout
  focusMode: boolean
  selectedEntityId: string | null
  panOffset: { x: number; y: number }
  zoom: number
  entities: Entity[]
  /** Live canvas size; the restore pan clamp uses the same dynamic bound as drag. */
  canvas: CanvasSize
  setLayout: (layout: GraphLayout) => void
  setFocusMode: (focus: boolean) => void
  setPanOffset: (offset: { x: number; y: number }) => void
  setZoom: (zoom: number) => void
  selectEntity: (id: string | null) => void
}

/**
 * Owns the graph snapshot state machine: save, restore, clear, and the
 * revision-comparison overlay (Plan 157 & Plan 170).
 *
 * Extracted from `GraphView` so the already-oversized view module does not
 * grow with the comparison feature.
 */
export const useGraphSnapshotComparison = ({
  layout,
  focusMode,
  selectedEntityId,
  panOffset,
  zoom,
  entities,
  canvas,
  setLayout,
  setFocusMode,
  setPanOffset,
  setZoom,
  selectEntity,
}: GraphSnapshotComparisonParams) => {
  // Whether a restorable snapshot exists. Read once on mount and refreshed
  // after every save/restore so the toolbar can disable the restore action
  // without touching storage on every render.
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(() => readGraphSnapshot() !== null)
  const [comparisonDiff, setComparisonDiff] = useState<GraphSnapshotDiff | null>(null)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const announce = useAnnouncer()

  const saveSnapshot = useCallback(() => {
    const saved = saveGraphSnapshot(
      buildGraphSnapshot(
        { layout, selectedEntityId, focusMode },
        { panX: panOffset.x, panY: panOffset.y, zoom },
        entities,
      ),
    )
    if (saved) announce(announceT('announce.snapshotSaved'))
    setHasSnapshot(saved)
  }, [announce, layout, selectedEntityId, focusMode, panOffset, zoom, entities])

  /**
   * Restores the saved canvas state. The selection is only re-applied when it
   * still names an entity in the current corpus - a snapshot taken before an
   * import must not leave focus mode pointed at a deleted node.
   */
  const restoreSnapshot = useCallback(() => {
    const snapshot = readGraphSnapshot()
    if (!snapshot) {
      setHasSnapshot(false)
      return
    }
    announce(announceT('announce.snapshotRestored'))
    setLayout(snapshot.layout)
    setFocusMode(snapshot.focusMode)
    // A snapshot is user-writable and survives deploys; a pan far outside the
    // canvas would park the whole graph off-view with no way back except the
    // Home key. Clamp to the same dynamic bound the drag path enforces — the
    // static MAX_PAN floor would silently alter legal deep pans (zoom above 1
    // on a grown canvas) and break the save/restore round trip.
    const maxPan = computeMaxPan(canvas, snapshot.zoom)
    setPanOffset({
      x: clamp(snapshot.panX, -maxPan, maxPan),
      y: clamp(snapshot.panY, -maxPan, maxPan),
    })
    // Clamp to the same range the keyboard handler uses. A snapshot is
    // user-writable and survives deploys, so an out-of-range value would
    // otherwise produce a degenerate viewBox.
    setZoom(Math.min(Math.max(snapshot.zoom, MIN_ZOOM), MAX_ZOOM))
    const stillPresent = entities.some((e) => e.id === snapshot.selectedEntityId)
    selectEntity(stillPresent ? snapshot.selectedEntityId : null)
  }, [announce, canvas, entities, selectEntity, setLayout, setFocusMode, setPanOffset, setZoom])

  /** Discards the saved snapshot and disables the restore action. */
  const clearSnapshot = useCallback(() => {
    announce(announceT('announce.snapshotCleared'))
    clearGraphSnapshot()
    setHasSnapshot(false)
    setIsCompareOpen(false)
    setComparisonDiff(null)
  }, [announce])

  /** Diffs the live canvas against the stored snapshot and opens the overlay. */
  const compareSnapshot = useCallback(() => {
    const snapshot = readGraphSnapshot()
    if (!snapshot) {
      setHasSnapshot(false)
      return
    }
    setComparisonDiff(
      diffGraphSnapshot(snapshot, {
        layout,
        focusMode,
        selectedEntityId,
        zoom,
        panOffset,
        entities,
      }),
    )
    setIsCompareOpen(true)
  }, [layout, focusMode, selectedEntityId, zoom, panOffset, entities])

  const closeCompare = useCallback(() => {
    setIsCompareOpen(false)
  }, [])

  return {
    hasSnapshot,
    comparisonDiff,
    isCompareOpen,
    saveSnapshot,
    restoreSnapshot,
    clearSnapshot,
    compareSnapshot,
    closeCompare,
  }
}
