'use client'

import { useStudioStore } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import { seedGraph } from '@/lib/studio/seed-data'
import {
  CircleDot,
  Circle,
  GitFork,
  Layers,
  Focus,
  Camera,
  RotateCcw,
  RotateCw,
  Download,
  Maximize2,
} from 'lucide-react'
import { useState, useRef, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

type LayoutType = 'force' | 'circular' | 'hierarchical'

export function GraphView() {
  const { entities, selectedEntityId, selectEntity } = useStudioStore()
  const [layout, setLayout] = useState<LayoutType>('force')
  const [focusMode, setFocusMode] = useState(false)

  // Build nodes from entities + seed positions
  const { nodes, edges } = useMemo(() => {
    const seedMap = new Map(seedGraph.nodes.map((n) => [n.id, n]))
    const nodes = entities.map((e) => {
      const seed = seedMap.get(e.id)
      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: seed?.x ?? Math.random() * 600 + 100,
        y: seed?.y ?? Math.random() * 400 + 80,
      }
    })
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = entities
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
    return { nodes, edges }
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
    ? positioned.filter((n) => n.id === selectedEntityId || edges.some(e => (e.source === selectedEntityId && e.target === n.id) || (e.target === selectedEntityId && e.source === n.id)))
    : positioned

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))

  const svgRef = useRef<SVGSVGElement>(null)
  const reducedMotion = useReducedMotion()
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

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card/50 px-5 py-2.5">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {(['force', 'circular', 'hierarchical'] as LayoutType[]).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              aria-pressed={layout === l}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors focus-ring',
                layout === l ? 'bg-primary text-primary-foreground shadow-sm' : 'text-ink-mute hover:text-ink',
              )}
            >
              {l === 'force' && <GitFork className="h-3 w-3" />}
              {l === 'circular' && <Circle className="h-3 w-3" />}
              {l === 'hierarchical' && <Layers className="h-3 w-3" />}
              {l}
            </button>
          ))}
        </div>

        <Divider />

        <ToolbarBtn icon={Focus} label="Focus neighborhood" active={focusMode} onClick={() => setFocusMode(!focusMode)} />
        <ToolbarBtn icon={RotateCcw} label="Undo" disabled />
        <ToolbarBtn icon={RotateCw} label="Redo" disabled />
        <ToolbarBtn icon={Camera} label="Save snapshot" disabled />

        <div className="flex-1" />

        <span className="hidden text-[11px] text-ink-faint sm:inline">
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </span>
        <ToolbarBtn icon={Download} label="Export PNG" disabled />
      </div>

      {/* Canvas */}
      <div className="relative flex-1 canvas-grid overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 800 560"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Knowledge graph with ${visibleNodes.length} entities and ${visibleEdges.length} connections`}
        >
          {/* Edges */}
          <g>
            {visibleEdges.map((e) => {
              const s = visibleNodes.find((n) => n.id === e.source)
              const t = visibleNodes.find((n) => n.id === e.target)
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
                  {isHighlight && (
                    <text
                      x={(s.x + t.x) / 2}
                      y={(s.y + t.y) / 2 - 4}
                      textAnchor="middle"
                      className="fill-ink-mute font-sans text-[9px] italic"
                    >
                      {e.relation}
                    </text>
                  )}
                </g>
              )
            })}
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
                  onClick={() => selectEntity(isSelected ? null : n.id)}
                  onKeyDown={(e) => handleNodeKeyDown(n.id, e)}
                  onFocus={() => setFocusedNodeId(n.id)}
                  onBlur={() => setFocusedNodeId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label} — ${meta.label}${isSelected ? ' (selected)' : ''}`}
                  className={cn(
                    'cursor-pointer outline-none',
                    (focusedNodeId === n.id || isSelected) && 'focus-visible:ring-2 focus-visible:ring-saffron/60',
                  )}
                  style={focusedNodeId === n.id ? { filter: 'drop-shadow(0 0 3px var(--saffron))' } : undefined}
                >
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
                      'font-sans text-[10px] font-medium transition-colors',
                      isSelected ? 'fill-ink' : 'fill-ink-soft',
                    )}
                  >
                    {n.label.length > 24 ? n.label.slice(0, 22) + '…' : n.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Empty overlay */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CircleDot className="mx-auto mb-2 h-8 w-8 text-ink-faint/40" />
              <p className="text-[13px] text-ink-mute">No entities to graph yet.</p>
            </div>
          </div>
        )}

        {/* Floating legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-background/90 p-3 backdrop-blur-sm">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Entity types
          </div>
          <div className="space-y-1">
            {(Object.keys(ENTITY_TYPE_META) as (keyof typeof ENTITY_TYPE_META)[]).map((t) => {
              const m = ENTITY_TYPE_META[t]
              return (
                <div key={t} className="flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className={cn('h-2 w-2 rounded-full', m.dot)} />
                  {m.label}
                </div>
              )
            })}
          </div>
        </div>

        {/* Zoom hint */}
        <div className="absolute right-4 top-4 flex flex-col gap-1 rounded-md border border-border bg-background/90 p-1 backdrop-blur-sm">
          <button className="rounded p-1.5 text-ink-mute hover:bg-muted hover:text-ink" aria-label="Zoom in">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: typeof Focus
  label: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (coming soon)` : label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />
}
