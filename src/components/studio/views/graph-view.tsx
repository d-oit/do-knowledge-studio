'use client'

import { getHistoryAvailability } from '@/lib/studio/slices/history-slice'
import { useStudioStore } from '@/lib/studio/store'
import { seedGraph } from '@/lib/studio/seed-data'
import { layoutNodes, placeGraphNodes } from '@/lib/studio/graph-layout'
import { canvasSize, canvasViewBox } from '@/lib/studio/graph-viewport'
import { useElementSize } from '@/lib/studio/use-element-size'
import { getEntityTypeDefs, getEntityTypeMeta } from '@/lib/studio/entity-types'
import { translate as entityTypesT } from '@/lib/i18n/messages/entity-types'
import { exportGraphPng } from './export-graph-png'
import { CircleDot, GitFork, Plus } from 'lucide-react'
import { useState, useRef, useMemo, useCallback } from 'react'
import { GraphToolbar } from './graph-toolbar'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { buildAdjacencyIndex } from '@/lib/studio/graph-index'
import { translate as graphT } from '@/lib/i18n/messages/graph'
import { translate as navT } from '@/lib/i18n/messages/nav'
import { ViewEmptyState, ViewHeader, VIEW_CONTAINER_CLASS } from '../ui/shared-primitives'
import type { GraphLayout } from '@/lib/studio/graph-snapshot'
import { GraphComparisonDialog } from './graph-comparison-dialog'
import { useGraphKeyboard } from './use-graph-keyboard'
import { useGraphSnapshotComparison } from './use-graph-snapshot-comparison'
import { FOCUS_MODE_FILTER_STYLE, GraphEdgeElement } from './graph-elements'
import { useGraphCanvasGestures } from './use-graph-canvas-gestures'
import { GraphQueryPanel } from './graph-query-panel'
import {
  EMPTY_GRAPH_FILTER,
  countActiveFilterFacets,
  filterGraph,
  pathEdgeKeys,
  undirectedEdgeKey,
  type GraphFilter,
  type GraphPathResult,
} from '@/lib/studio/graph-query'
import type { SavedGraphView } from '@/lib/studio/graph-views'

/**
 * Keep the first edge per `id`, preserving input order, in one O(E) pass. The
 * `id` is the `${source}-${target}` string the caller builds — the same key the
 * previous `findIndex`-per-candidate filter matched on.
 */
const dedupeEdgesById = <T extends { id: string }>(edges: T[]): T[] => {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const edge of edges) {
    if (seen.has(edge.id)) continue
    seen.add(edge.id)
    unique.push(edge)
  }
  return unique
}

/** Interactive knowledge graph view with force, circular, and hierarchical layouts. */
export const GraphView = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const graphViews = useStudioStore((s) => s.graphViews)
  const saveGraphView = useStudioStore((s) => s.saveGraphView)
  const deleteGraphView = useStudioStore((s) => s.deleteGraphView)
  const selectedEntityId = useStudioStore((s) => s.selectedEntityId)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const startNew = useStudioStore((s) => s.startNew)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const entityHistory = useStudioStore((s) => s.entityHistory)
  const historyIndex = useStudioStore((s) => s.historyIndex)
  const { canUndo, canRedo } = getHistoryAvailability(historyIndex, entityHistory.length)
  const [layout, setLayout] = useState<GraphLayout>('force')
  const [focusMode, setFocusMode] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // Structural queries are canvas chrome, not corpus data: they stay in view
  // state so a reload starts from the full graph rather than a hidden filter.
  const [filter, setFilter] = useState<GraphFilter>(EMPTY_GRAPH_FILTER)
  const [pathResult, setPathResult] = useState<GraphPathResult | null>(null)
  const [queriesOpen, setQueriesOpen] = useState(false)

  // The placement band reshapes itself to the rendered canvas (plans/152 §6.1).
  // The measured box is the canvas container's own, never a node position the
  // layout produces, so reshaping the band cannot change what it is measured
  // from — the measurement is loop-free by construction.
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewport = useElementSize(canvasRef)

  // Build adjacency index for O(1) focus-mode neighbor lookups
  const adjacency = useMemo(() => buildAdjacencyIndex(entities), [entities])

  // Filtering happens before placement so hidden nodes cannot stretch the
  // canvas band or leave dangling edges behind.
  const filtered = useMemo(
    () => filterGraph(entities, claims, filter),
    [entities, claims, filter],
  )

  const { nodes, edges } = useMemo(() => {
    const nodesList = placeGraphNodes(filtered.entities, seedGraph.nodes, viewport)
    const nodeIds = new Set(nodesList.map((n) => n.id))
    const edgesList = dedupeEdgesById(
      filtered.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    )
    return { nodes: nodesList, edges: edgesList }
  }, [filtered, viewport])

  // Apply the layout transform; `layoutNodes` is shared with the snapshot
  // restore clamp so both derive canvas geometry from the same math.
  const positioned = useMemo(() => layoutNodes(nodes, layout), [nodes, layout])

  // The canvas grows with the placed nodes so nothing is drawn off-canvas. It is
  // derived from `positioned` rather than `visibleNodes`: focus mode filters what
  // is drawn, and the canvas must not shrink under the nodes when it toggles.
  const canvas = useMemo(() => canvasSize(positioned), [positioned])

  // Snapshot state and canvas shortcuts; the shortcuts clamp panning with the
  // same dynamic bound the drag path uses, so they need the live canvas (the
  // snapshot restore derives its bound from the saved layout instead).
  const {
    hasSnapshot,
    comparisonDiff,
    isCompareOpen,
    saveSnapshot,
    restoreSnapshot,
    clearSnapshot,
    compareSnapshot,
    closeCompare,
  } = useGraphSnapshotComparison({
    layout,
    focusMode,
    selectedEntityId,
    panOffset,
    zoom,
    entities,
    viewport,
    setLayout,
    setFocusMode,
    setPanOffset,
    setZoom,
    selectEntity,
  })
  const handleGraphKeyDown = useGraphKeyboard({
    isCompareOpen,
    selectedEntityId,
    entities,
    canvas,
    zoom,
    setPanOffset,
    setZoom,
  })

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

  // Path highlight: canonical undirected keys, because a traversal may walk a
  // stored link in either direction.
  const pathEdgeKeySet = useMemo(
    () => (pathResult?.found ? pathEdgeKeys(pathResult.edges) : new Set<string>()),
    [pathResult],
  )
  const pathNodeIdSet = useMemo(
    () => new Set(pathResult?.found ? pathResult.nodeIds : []),
    [pathResult],
  )
  const activeFilterCount = countActiveFilterFacets(filter)
  const currentViewInput = useMemo(
    () => ({
      name: '',
      filter,
      layout,
      focusMode,
      viewport: { panX: panOffset.x, panY: panOffset.y, zoom },
    }),
    [filter, layout, focusMode, panOffset, zoom],
  )

  const handleApplyView = useCallback(
    (view: SavedGraphView) => {
      setFilter(view.filter)
      setLayout(view.layout)
      setFocusMode(view.focusMode)
      setPanOffset({ x: view.viewport.panX, y: view.viewport.panY })
      setZoom(view.viewport.zoom)
      setPathResult(null)
    },
    [],
  )

  const reducedMotion = useReducedMotion()
  const { svgRef, isDraggingRef, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } =
    useGraphCanvasGestures({ canvas, zoom, setZoom, panOffset, setPanOffset })
  const handleExportPng = useCallback(() => {
    exportGraphPng(svgRef.current)
  }, [svgRef])

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
    [isDraggingRef, selectEntity],
  )


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
        onCompareSnapshot={compareSnapshot}
        hasSnapshot={hasSnapshot}
        showMore={showMore}
        onToggleShowMore={() => { setShowMore(!showMore) }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onExportPng={handleExportPng}
        nodeCount={visibleNodes.length}
        edgeCount={visibleEdges.length}
        queriesOpen={queriesOpen}
        onToggleQueries={() => { setQueriesOpen(!queriesOpen) }}
        activeFilterCount={activeFilterCount}
      />

      {queriesOpen && (
        <GraphQueryPanel
          entities={entities}
          claims={claims}
          filter={filter}
          onFilterChange={setFilter}
          pathResult={pathResult}
          onPathResult={setPathResult}
          views={graphViews}
          onSaveView={saveGraphView}
          onApplyView={handleApplyView}
          onDeleteView={deleteGraphView}
          currentView={currentViewInput}
        />
      )}

      {/* Canvas */}
      <div
        className="relative flex-1 canvas-grid overflow-hidden"
        ref={canvasRef}
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
                  pathHighlighted={pathEdgeKeySet.has(undirectedEdgeKey(edge.source, edge.target))}
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
                  aria-label={`${n.label} — ${meta.label}${isSelected ? ' (selected)' : ''}${pathNodeIdSet.has(n.id) ? ' (on path)' : ''}`}
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
                      stroke={pathNodeIdSet.has(n.id) ? 'var(--saffron)' : 'var(--background)'}
                      strokeWidth={pathNodeIdSet.has(n.id) ? 3 : 2}
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
              onAction={() => { startNew() }}
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

        <GraphComparisonDialog
          open={isCompareOpen}
          onClose={closeCompare}
          diff={comparisonDiff}
        />
      </div>
    </div>
  )
}
