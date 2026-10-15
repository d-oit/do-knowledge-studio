'use client'

import { useStudioStore } from '@/lib/studio/store'
import { seedGraph } from '@/lib/studio/seed-data'
import { placeGraphNodes } from '@/lib/studio/graph-layout'
import { canvasSize, canvasViewBox } from '@/lib/studio/graph-viewport'
import {
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PAN,
  DRAG_PAN_SLOP_PX,
  clamp,
  computeDragPanOffset,
  computeZoom,
  computeFocalZoom,
} from '@/lib/studio/graph-gestures'
import { getEntityTypeDefs, getEntityTypeMeta } from '@/lib/studio/entity-types'
import { translate as entityTypesT } from '@/lib/i18n/messages/entity-types'
import { todayStamp, downloadBlob } from './export-types'
import { CircleDot, GitFork, Plus } from 'lucide-react'
import { useState, useRef, useMemo, useCallback } from 'react'
import { GraphToolbar } from './graph-toolbar'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { buildAdjacencyIndex } from '@/lib/studio/graph-index'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import { translate as graphT } from '@/lib/i18n/messages/graph'
import { translate as navT } from '@/lib/i18n/messages/nav'
import { ViewEmptyState, ViewHeader, VIEW_CONTAINER_CLASS } from '../ui/shared-primitives'
import {
  buildGraphSnapshot,
  clearGraphSnapshot,
  readGraphSnapshot,
  saveGraphSnapshot,
  type GraphLayout,
} from '@/lib/studio/graph-snapshot'
import { FOCUS_MODE_FILTER_STYLE, GraphEdgeElement } from './graph-elements'

/** Interactive knowledge graph view with force, circular, and hierarchical layouts. */
export const GraphView = () => {
  const entities = useStudioStore((s) => s.entities)
  const selectedEntityId = useStudioStore((s) => s.selectedEntityId)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const startNew = useStudioStore((s) => s.startNew)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const entityHistory = useStudioStore((s) => s.entityHistory)
  const historyIndex = useStudioStore((s) => s.historyIndex)
  const [layout, setLayout] = useState<GraphLayout>('force')
  const [focusMode, setFocusMode] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // Whether a restorable snapshot exists. Read once on mount and refreshed
  // after every save/restore so the toolbar can disable the restore action
  // without touching storage on every render.
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(() => readGraphSnapshot() !== null)
  const announce = useAnnouncer()

  // Build adjacency index for O(1) focus-mode neighbor lookups
  const adjacency = useMemo(() => buildAdjacencyIndex(entities), [entities])

  const { nodes, edges } = useMemo(() => {
    const nodesList = placeGraphNodes(entities, seedGraph.nodes)
    const nodeIds = new Set(nodesList.map((n) => n.id))
    const edgesList = entities
      .flatMap((e) =>
        e.links
          .filter((l) => nodeIds.has(l.targetId))
          .map((l) => ({
            id: `${e.id}-${l.targetId}`,
            source: e.id,
            target: l.targetId,
            relation: l.relation,
          })),
      )
      .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
    return { nodes: nodesList, edges: edgesList }
  }, [entities])

  // Apply layout transforms
  const positioned = useMemo(() => {
    if (layout === 'circular') {
      const cx = 400, cy = 280, r = 200
      return nodes.map((n, i) => ({
        ...n,
        x: cx + r * Math.cos((2 * Math.PI * i) / nodes.length),
        y: cy + r * Math.sin((2 * Math.PI * i) / nodes.length),
      }))
    }
    if (layout === 'hierarchical') {
      const cols = Math.ceil(Math.sqrt(nodes.length))
      return nodes.map((n, i) => ({
        ...n,
        x: 120 + (i % cols) * 180,
        y: 100 + Math.floor(i / cols) * 140,
      }))
    }
    return nodes
  }, [nodes, layout])

  // The canvas grows with the placed nodes so nothing is drawn off-canvas. It is
  // derived from `positioned` rather than `visibleNodes`: focus mode filters what
  // is drawn, and the canvas must not shrink under the nodes when it toggles.
  const canvas = useMemo(() => canvasSize(positioned), [positioned])

  const visibleNodes = useMemo(() => {
    if (focusMode && selectedEntityId) {
      const neighbors = adjacency.get(selectedEntityId)
      return positioned.filter(
        (n) => n.id === selectedEntityId || (neighbors?.has(n.id) ?? false),
      )
    }
    return positioned
  }, [focusMode, selectedEntityId, adjacency, positioned])

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id))
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [visibleNodes, edges])

  const visibleNodeMap = useMemo(
    () => new Map(visibleNodes.map((n) => [n.id, n])),
    [visibleNodes],
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const reducedMotion = useReducedMotion()
  // Pointer drag-to-pan state tracking
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
const handleGraphKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const PAN_STEP = 30
      const ZOOM_STEP = 0.15
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x + PAN_STEP, y: p.y }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x - PAN_STEP, y: p.y }))
          break
        case 'ArrowUp':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x, y: p.y + PAN_STEP }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x, y: p.y - PAN_STEP }))
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))
          break
        case '-':
          e.preventDefault()
          setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))
          break
        case 'Home':
          e.preventDefault()
          setPanOffset({ x: 0, y: 0 })
          setZoom(1)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedEntityId) {
            e.preventDefault()
            // Deleting from the canvas removes the node with no other visual
            // trace, so the live region names what was destroyed.
            const removed = entities.find((entity) => entity.id === selectedEntityId)
            if (removed) announce(announceT('announce.entityDeleted', removed.name))
            useStudioStore.getState().deleteEntity(selectedEntityId)
          }
          break
        default:
          break
      }
    },
    [announce, entities, selectedEntityId],
  )

  const handleExportPng = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return

    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svg)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth * 2
        canvas.height = img.naturalHeight * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          if (!blob) return
          downloadBlob(`knowledge-graph-${todayStamp()}.png`, blob)
        }, 'image/png')
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.src = url
  }, [])

  // Gate the rotation animation on the selected node indicator
  const animDur = reducedMotion ? '0s' : '8s'
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  const handleNodeKeyDown = useCallback(
    (nodeId: string, e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        selectEntity(nodeId)
      }
    },
    [selectEntity],
  )
  const handleNodeClick = useCallback(
    (nodeId: string, isCurrentlySelected: boolean) => {
      if (isDraggingRef.current) return
      selectEntity(isCurrentlySelected ? null : nodeId)
    },
    [selectEntity],
  )

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Only initiate canvas panning with primary mouse button or single touch
    if (e.button !== 0) return
    activePointerIdRef.current = e.pointerId
    pointerOriginRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = false
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !pointerOriginRef.current) return

    const dx = e.clientX - pointerOriginRef.current.x
    const dy = e.clientY - pointerOriginRef.current.y

    if (!isDraggingRef.current) {
      if (Math.hypot(dx, dy) >= DRAG_PAN_SLOP_PX) {
        isDraggingRef.current = true
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Pointer capture may fail on simulated / synthetic events
        }
      } else {
        return
      }
    }

    pointerOriginRef.current = { x: e.clientX, y: e.clientY }
    setPanOffset((prev) => computeDragPanOffset(prev, dx, dy))
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Safe ignore
    }
    activePointerIdRef.current = null
    pointerOriginRef.current = null
    // Allow click event to process before clearing dragging flag
    setTimeout(() => {
      isDraggingRef.current = false
    }, 0)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const focalPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    setZoom((currZoom) => {
      const nextZoom = computeZoom(currZoom, e.deltaY)
      setPanOffset((currPan) => {
        const focalResult = computeFocalZoom(currZoom, nextZoom, currPan, focalPoint)
        return focalResult.panOffset
      })
      return nextZoom
    })
  }, [])

  const saveSnapshot = useCallback(() => {
    const saved = saveGraphSnapshot(
      buildGraphSnapshot(
        { layout, selectedEntityId, focusMode },
        { panX: panOffset.x, panY: panOffset.y, zoom },
      ),
    )
    if (saved) announce(announceT('announce.snapshotSaved'))
    setHasSnapshot(saved)
  }, [announce, layout, selectedEntityId, focusMode, panOffset, zoom])

  /**
   * Restores the saved canvas state. The selection is only re-applied when it
   * still names an entity in the current corpus — a snapshot taken before an
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
    // Home key. Clamp to a generous multiple of the visible canvas.
    setPanOffset({
      x: clamp(snapshot.panX, -MAX_PAN, MAX_PAN),
      y: clamp(snapshot.panY, -MAX_PAN, MAX_PAN),
    })
    // Clamp to the same range the keyboard handler uses. A snapshot is
    // user-writable and survives deploys, so an out-of-range value would
    // otherwise produce a degenerate viewBox.
    setZoom(Math.min(Math.max(snapshot.zoom, MIN_ZOOM), MAX_ZOOM))
    const stillPresent = entities.some((e) => e.id === snapshot.selectedEntityId)
    selectEntity(stillPresent ? snapshot.selectedEntityId : null)
  }, [announce, entities, selectEntity])

  /** Discards the saved snapshot and disables the restore action. */
  const clearSnapshot = useCallback(() => {
    announce(announceT('announce.snapshotCleared'))
    clearGraphSnapshot()
    setHasSnapshot(false)
  }, [announce])

  return (
    <div className={cn('flex h-full flex-col', VIEW_CONTAINER_CLASS)}>
      <ViewHeader icon={GitFork} title={navT('nav.graph.title')} subtitle={graphT('graph.subtitle')} />

      {/* Toolbar — extracted to GraphToolbar */}
      <GraphToolbar
        layout={layout}
        onLayoutChange={setLayout}
        focusMode={focusMode}
        onToggleFocusMode={() => { setFocusMode(!focusMode) }}
        onSaveSnapshot={saveSnapshot}
        onRestoreSnapshot={restoreSnapshot}
        onClearSnapshot={clearSnapshot}
        hasSnapshot={hasSnapshot}
        showMore={showMore}
        onToggleShowMore={() => { setShowMore(!showMore) }}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < entityHistory.length - 1}
        onUndo={undo}
        onRedo={redo}
        onExportPng={handleExportPng}
        nodeCount={visibleNodes.length}
        edgeCount={visibleEdges.length}
      />

      {/* Canvas */}
      <div
        className="relative flex-1 canvas-grid overflow-hidden"
        tabIndex={0}
        role="application"
        aria-label="Graph canvas — use arrow keys to pan, +/- to zoom, Home to reset, Delete to remove selected entity"
        onKeyDown={handleGraphKeyDown}
      >
        <svg
          ref={svgRef}
          viewBox={canvasViewBox(canvas, zoom, panOffset)}
          className="h-full w-full touch-none select-none cursor-grab active:cursor-grabbing"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Knowledge graph with ${visibleNodes.length} entities and ${visibleEdges.length} connections`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Edges */}
          <g>
            {visibleEdges.map((edge) => {
              const sourceNode = visibleNodeMap.get(edge.source)
              const targetNode = visibleNodeMap.get(edge.target)
              if (!sourceNode || !targetNode) return null
              return (
                <GraphEdgeElement
                  key={edge.id}
                  edge={edge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  selectedEntityId={selectedEntityId}
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {visibleNodes.map((n) => {
              const meta = getEntityTypeMeta(n.type)
              const isSelected = n.id === selectedEntityId
              const r = isSelected ? 14 : 11
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => {
                    handleNodeClick(n.id, isSelected)
                  }}
                  onKeyDown={(e) => { handleNodeKeyDown(n.id, e) }}
                  onFocus={() => { setFocusedNodeId(n.id) }}
                  onBlur={() => { setFocusedNodeId(null) }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label} — ${meta.label}${isSelected ? ' (selected)' : ''}`}
                  className={cn(
                    'cursor-pointer outline-none',
                    (focusedNodeId === n.id || isSelected) && 'focus-visible:ring-2 focus-visible:ring-saffron/60',
                  )}
                  style={focusedNodeId === n.id ? FOCUS_MODE_FILTER_STYLE : undefined}
                >
                  <g aria-hidden="true">
                    {isSelected && (
                      <circle r={r + 6} fill="none" className="stroke-saffron" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6}>
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={animDur} repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      r={r}
                      className={cn(
                        'transition-all',
                        isSelected ? 'fill-saffron' : meta.dot.replace('bg-', 'fill-'),
                      )}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                    <circle r={r * 0.4} fill="var(--background)" opacity={0.3} />
                    <text
                      y={r + 14}
                      textAnchor="middle"
                      className={cn(
                        'font-sans text-caption font-medium transition-colors',
                        isSelected ? 'fill-ink' : 'fill-ink-soft',
                      )}
                    >
                      {n.label.length > 24 ? `${n.label.slice(0, 22)}…` : n.label}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Empty overlay — the canvas is a dead end without a create action. */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <ViewEmptyState
              icon={CircleDot}
              title={graphT('graph.empty.title')}
              body={graphT('graph.empty.body')}
              actionLabel={graphT('graph.empty.action')}
              actionIcon={Plus}
              onAction={startNew}
              className="pointer-events-auto max-w-md bg-card/95"
            />
          </div>
        )}

        {/* Floating legend */}
        {/* pointer-events-none: display-only legend must not block clicks on
            nodes rendered beneath it (intermittent `Mentions Note` click loss). */}
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-background/90 p-3 backdrop-blur-sm">
          <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-faint">
            {entityTypesT('entity-types.legendHeading')}
          </div>
          <div className="space-y-1">
            {getEntityTypeDefs().map((def) => (
              <div key={def.id} className="flex items-center gap-2 text-label text-ink-soft">
                {/* A registered type may carry a blank `dot` class; fall back
                    to the neutral token so the legend marker stays visible. */}
                <span className={cn('h-2 w-2 rounded-full', def.dot.trim() ? def.dot : 'bg-ink-faint')} />
                {def.label}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
