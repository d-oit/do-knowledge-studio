'use client'

import { useStudioStore } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import { seedGraph } from '@/lib/studio/seed-data'
import { todayStamp, downloadBlob } from './export-types'
import { CircleDot } from 'lucide-react'
import { useState, useRef, useMemo, useCallback } from 'react'
import { GraphToolbar, type LayoutType } from './graph-toolbar'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { buildAdjacencyIndex } from '@/lib/studio/graph-index'

/**
 * Deterministic hash → [0, 1) float for stable graph node positions.
 * Replaces Math.random() so the layout does not shuffle on every render.
 */
const seededRandom = (seed: string): number => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  // Mix the bits for better distribution, then scale to [0, 1)
  return (Math.abs((hash * 2654435761) >>> 0) % 10_000) / 10_000
}

/** CSS filter applied to focused nodes in focus mode. */
const FOCUS_MODE_FILTER_STYLE: React.CSSProperties = {
  filter: 'drop-shadow(0 0 3px var(--saffron))',
} as const

/** Interactive knowledge graph view with force, circular, and hierarchical layouts. */
export const GraphView = () => {
  const entities = useStudioStore((s) => s.entities)
  const selectedEntityId = useStudioStore((s) => s.selectedEntityId)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const entityHistory = useStudioStore((s) => s.entityHistory)
  const historyIndex = useStudioStore((s) => s.historyIndex)
  const [layout, setLayout] = useState<LayoutType>('force')
  const [focusMode, setFocusMode] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  // Build adjacency index for O(1) focus-mode neighbor lookups
  const adjacency = useMemo(() => buildAdjacencyIndex(entities), [entities])

  const { nodes, edges } = useMemo(() => {
    const seedMap = new Map(seedGraph.nodes.map((n) => [n.id, n]))
    const nodesList = entities.map((e) => {
      const seed = seedMap.get(e.id)
      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: seed?.x ?? seededRandom(e.id + ':x') * 600 + 100,
        y: seed?.y ?? seededRandom(e.id + ':y') * 400 + 80,
      }
    })
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

  const visibleNodes = focusMode && selectedEntityId
    ? positioned.filter((n) => {
        if (n.id === selectedEntityId) return true
        const neighbors = adjacency.get(selectedEntityId)
        return neighbors?.has(n.id) ?? false
      })
    : positioned

  const { visibleEdges } = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id))
    const filtered = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    return { visibleEdges: filtered }
  }, [visibleNodes, edges])

  const svgRef = useRef<SVGSVGElement>(null)
  const reducedMotion = useReducedMotion()

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
          setZoom((z) => Math.min(z + ZOOM_STEP, 3))
          break
        case '-':
          e.preventDefault()
          setZoom((z) => Math.max(z - ZOOM_STEP, 0.3))
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
            useStudioStore.getState().deleteEntity(selectedEntityId)
          }
          break
        default:
          break
      }
    },
    [selectedEntityId],
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
      selectEntity(isCurrentlySelected ? null : nodeId)
    },
    [selectEntity],
  )

  const saveSnapshot = useCallback(() => {
    try {
      const snapshot = {
        layout,
        selectedEntityId,
        focusMode,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('dks-graph-snapshot', JSON.stringify(snapshot))
    } catch (error) {
      console.error('Failed to save graph snapshot:', error instanceof Error ? error.message : error)
    }
  }, [layout, selectedEntityId, focusMode])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — extracted to GraphToolbar */}
      <GraphToolbar
        layout={layout}
        onLayoutChange={setLayout}
        focusMode={focusMode}
        onToggleFocusMode={() => { setFocusMode(!focusMode) }}
        onSaveSnapshot={saveSnapshot}
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
          viewBox={`${-panOffset.x / zoom} ${-panOffset.y / zoom} ${800 / zoom} ${560 / zoom}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Knowledge graph with ${visibleNodes.length} entities and ${visibleEdges.length} connections`}
        >
          {/* Edges */}
          <g>
            {(() => {
              const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]))
              return visibleEdges.map((e) => {
                const s = nodeMap.get(e.source)
                const t = nodeMap.get(e.target)
                if (!s || !t) return null
                const isHighlight =
                  selectedEntityId && (e.source === selectedEntityId || e.target === selectedEntityId)
                return (
                  <g key={e.id}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      className={cn(
                        'transition-all',
                        isHighlight ? 'stroke-saffron' : 'stroke-border',
                      )}
                      strokeWidth={isHighlight ? 2 : 1.5}
                    />
                    {isHighlight && (() => {
                      const dx = t.x - s.x
                      const dy = t.y - s.y
                      const length = Math.hypot(dx, dy) || 1
                      const isAttachedToSelected = selectedEntityId && (e.source === selectedEntityId || e.target === selectedEntityId)
                      const labelOffset = isAttachedToSelected ? 14 : 8

                      const labelX = (s.x + t.x) / 2 + (-dy / length) * labelOffset
                      const labelY = (s.y + t.y) / 2 + (dx / length) * labelOffset

                      return (
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          stroke="var(--background)"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke fill"
                          className="fill-ink-mute font-sans text-badge italic"
                        >
                          {e.relation}
                        </text>
                      )
                    })()}
                  </g>
                )
              })
            })()}
          </g>

          {/* Nodes */}
          <g>
            {visibleNodes.map((n) => {
              const meta = ENTITY_TYPE_META[n.type]
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
                      {n.label.length > 24 ? n.label.slice(0, 22) + '…' : n.label}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Empty overlay */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CircleDot aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-ink-faint/40" />
              <p className="text-[13px] text-ink-mute">No entities to graph yet.</p>
            </div>
          </div>
        )}

        {/* Floating legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-background/90 p-3 backdrop-blur-sm">
          <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-faint">
            Entity types
          </div>
          <div className="space-y-1">
            {(Object.keys(ENTITY_TYPE_META) as (keyof typeof ENTITY_TYPE_META)[]).map((t) => {
              const m = ENTITY_TYPE_META[t as keyof typeof ENTITY_TYPE_META]
              return (
                <div key={t} className="flex items-center gap-2 text-label text-ink-soft">
                  <span className={cn('h-2 w-2 rounded-full', m.dot)} />
                  {m.label}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
