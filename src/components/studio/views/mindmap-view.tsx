'use client'

import { useStudioStore } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import {
  BrainCircuit,
  Plus,
  Trash2,
  Edit3,
  Undo2,
  Redo2,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  Sliders,
} from 'lucide-react'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Divider } from '../ui/shared-primitives'
import { todayStamp, downloadBlob } from './export-helpers'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { motion, AnimatePresence } from 'framer-motion'
import { buildEntityIndex } from '@/lib/studio/graph-index'

interface TreeNode {
  entity: { id: string; name: string; type: keyof typeof ENTITY_TYPE_META }
  children: TreeNode[]
  expanded: boolean
}

const NODE_INDENT_PX = 28

function getNodeIndentStyle(level: number): React.CSSProperties {
  return { paddingLeft: `${level * NODE_INDENT_PX}px` }
}

export function MindMapView() {
  const entities = useStudioStore((s) => s.entities)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const setView = useStudioStore((s) => s.setView)
  const [rootId, setRootId] = useState(entities[0]?.id || '')
  const [depth, setDepth] = useState(3)
  const [compact, setCompact] = useState(false)
  const reducedMotion = useReducedMotion()
  const entityIndex = useMemo(() => buildEntityIndex(entities), [entities])
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [syncKey, setSyncKey] = useState(0)
  const commitEntity = useStudioStore((s) => s.commitEntity)
  const deleteEntity = useStudioStore((s) => s.deleteEntity)
  const startEdit = useStudioStore((s) => s.startEdit)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const entityHistory = useStudioStore((s) => s.entityHistory)
  const historyIndex = useStudioStore((s) => s.historyIndex)

  const addChildToNode = useCallback((parentId: string) => {
    const nodeEntity = entityIndex.get(parentId)
    if (!nodeEntity) return
    const childId = crypto.randomUUID()
    const childEntity = {
      id: childId,
      name: 'New child',
      type: 'note' as const,
      description: '',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: [],
    }
    const parentWithLink = {
      ...nodeEntity,
      links: [...nodeEntity.links, { targetId: childId, relation: 'contains' }],
      updatedAt: new Date().toISOString(),
    }
    commitEntity(childEntity)
    commitEntity(parentWithLink)
    setFocusedNodeId(childId)
  }, [entityIndex, commitEntity])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!focusedNodeId) return
      const nodeEntity = entityIndex.get(focusedNodeId)
      if (!nodeEntity) return

      if (e.key === 'Tab') {
        e.preventDefault()
        addChildToNode(focusedNodeId)
        return
      }

      if (e.key === 'F2') {
        e.preventDefault()
        startEdit(focusedNodeId)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteEntity(focusedNodeId)
        setFocusedNodeId(null)
      }
    },
    [focusedNodeId, entityIndex, commitEntity, deleteEntity, startEdit],
  )

  useEffect(() => {
    const container = canvasRef.current
    if (!container) return
    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const exportPng = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    try {
      const rect = el.getBoundingClientRect()
      const svgNS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(svgNS, 'svg')
      svg.setAttribute('width', String(rect.width))
      svg.setAttribute('height', String(rect.height))
      const fo = document.createElementNS(svgNS, 'foreignObject')
      fo.setAttribute('width', '100%')
      fo.setAttribute('height', '100%')
      const nodeCopy = el.cloneNode(true) as HTMLElement
      const computedBg = getComputedStyle(el).backgroundColor
      nodeCopy.style.width = `${rect.width}px`
      nodeCopy.style.height = `${rect.height}px`
      nodeCopy.style.background = computedBg || '#faf8f3'
      fo.appendChild(nodeCopy)
      svg.appendChild(fo)
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(svg)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(2, 2)
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              downloadBlob(`mindmap-${todayStamp()}.png`, pngBlob)
            }
          })
        }
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (error) {
      console.error('Failed to export mind map as PNG:', error instanceof Error ? error.message : error)
    }
  }, [])

  const tree = useMemo(() => {
    const root = entityIndex.get(rootId) || entities[0]
    if (!root) return null

    const build = (
      entity: typeof root,
      currentDepth: number,
      visited: Set<string>,
    ): TreeNode => {
      const children: TreeNode[] = []
      if (currentDepth > 0) {
        for (const link of entity.links) {
          if (visited.has(link.targetId)) continue
          const child = entityIndex.get(link.targetId)
          if (child) {
            children.push(
              build(child, currentDepth - 1, new Set([...visited, entity.id])),
            )
          }
        }
      }
      return {
        entity: { id: entity.id, name: entity.name, type: entity.type },
        children,
        expanded: currentDepth > 0,
      }
    }
    return build(root, depth, new Set())
  }, [entityIndex, entities, rootId, depth, syncKey])

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const syncTree = useCallback(() => {
    setExpandedNodes(new Set())
    setSyncKey((k) => k + 1)
  }, [])

  const renderNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const meta = ENTITY_TYPE_META[node.entity.type]
    const isExpanded = expandedNodes.has(node.entity.id) || level === 0
    const hasChildren = node.children.length > 0

    return (
      <div key={node.entity.id} className="relative">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2, delay: level * 0.05 }}
          className="flex items-center"
          style={getNodeIndentStyle(level)}
        >
          {hasChildren ? (
            <button
              onClick={() => { toggleNode(node.entity.id) }}
              className="mr-1 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="mr-1 inline-block w-[18px]" />
          )}

          <div
            role="treeitem"
            tabIndex={0}
            aria-selected={focusedNodeId === node.entity.id ? true : undefined}
            aria-expanded={hasChildren ? isExpanded : undefined}
            onFocus={() => { setFocusedNodeId(node.entity.id) }}
            onBlur={() => { setFocusedNodeId(null) }}
            onClick={() => {
              selectEntity(node.entity.id)
              setView('editor')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                selectEntity(node.entity.id)
                setView('editor')
              }
              if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
                toggleNode(node.entity.id)
              }
              if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
                toggleNode(node.entity.id)
              }
            }}
            className={cn(
              'group flex cursor-pointer items-center gap-2 rounded-md border bg-card py-1.5 pr-3 transition-all hover:border-saffron/40 hover:shadow-sm',
              level === 0 ? 'border-saffron/40 px-4' : 'border-border px-3',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
            <span
              className={cn(
                'font-medium',
                level === 0 ? 'font-serif text-[15px] text-ink' : 'text-[13px] text-ink-soft',
              )}
            >
              {node.entity.name}
            </span>
            <span className="rounded bg-muted px-1.5 py-0 text-badge uppercase tracking-wide text-ink-faint">
              {meta.label}
            </span>
          </div>
        </motion.div>

        {/* Connector line */}
        {level === 0 && hasChildren && isExpanded && (
          <div className="ml-4 mt-1 h-3 w-px bg-border" />
        )}

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
              className="ml-4 border-l border-border pl-2"
            >
              {node.children.map((child) => renderNode(child, level + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-5 py-2.5">
        <select
          value={rootId}
          onChange={(e) => { setRootId(e.target.value) }}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
        >
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              Root: {e.name}
            </option>
          ))}
        </select>

        <Divider />

        <div className="flex items-center gap-1.5">
          <Sliders className="h-3 w-3 text-ink-faint" />
          <span className="text-label text-ink-mute">Depth</span>
          <input
            type="range"
            min={1}
            max={5}
            value={depth}
            onChange={(e) => { setDepth(Number(e.target.value)) }}
            className="w-20 accent-saffron"
          />
          <span className="font-mono text-label text-ink">{depth}</span>
        </div>

        <Divider />

        <ToolbarBtn icon={Plus} label="Add child" onClick={() => {
          if (focusedNodeId) addChildToNode(focusedNodeId)
        }} />
        <ToolbarBtn icon={Edit3} label="Rename" onClick={() => {
          if (focusedNodeId) startEdit(focusedNodeId)
        }} />
        <ToolbarBtn icon={Trash2} label="Delete" onClick={() => {
          if (focusedNodeId) { deleteEntity(focusedNodeId); setFocusedNodeId(null) }
        }} />
        <ToolbarBtn icon={Undo2} label="Undo" disabled={historyIndex <= 0} onClick={undo} />
        <ToolbarBtn icon={Redo2} label="Redo" disabled={historyIndex >= entityHistory.length - 1} onClick={redo} />

        <div className="flex-1" />

        <button
          onClick={() => { setCompact(!compact) }}
          className={cn(
            'rounded-md px-2 py-1.5 text-label font-medium transition-colors',
            compact ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
          )}
        >
          Compact
        </button>
        <ToolbarBtn icon={RefreshCw} label="Sync" onClick={syncTree} />
        <ToolbarBtn icon={Download} label="Export PNG" onClick={exportPng} />
      </div>

      {/* Hint */}
      <div className="border-b border-border bg-muted/30 px-5 py-1.5 text-label text-ink-faint">
        <kbd className="rounded border border-border bg-background px-1 font-mono">Tab</kbd> add child ·{' '}
        <kbd className="rounded border border-border bg-background px-1 font-mono">F2</kbd> rename ·{' '}
        <kbd className="rounded border border-border bg-background px-1 font-mono">Del</kbd> delete
      </div>

      {/* Canvas */}
      <div ref={canvasRef} tabIndex={-1} className="flex-1 canvas-grid overflow-auto p-6">
        {tree ? (
          <div className="mx-auto max-w-3xl">
            {renderNode(tree)}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <BrainCircuit className="mx-auto mb-2 h-10 w-10 text-ink-faint/40" />
              <p className="text-[13px] text-ink-mute">
                Add entities with links to build a mind map.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-border bg-card/50 px-5 py-2 text-label text-ink-faint">
        {tree ? `Root: ${tree.entity.name} · ${tree.children.length} direct children · depth ${depth}` : 'No data'}
      </div>
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Plus
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (coming soon)` : label}
      aria-label={label}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-label font-medium text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-mute"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
