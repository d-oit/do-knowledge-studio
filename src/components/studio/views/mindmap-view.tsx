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
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface TreeNode {
  entity: { id: string; name: string; type: keyof typeof ENTITY_TYPE_META }
  children: TreeNode[]
  expanded: boolean
}

export function MindMapView() {
  const { entities } = useStudioStore()
  const [rootId, setRootId] = useState(entities[0]?.id || '')
  const [depth, setDepth] = useState(3)
  const [compact, setCompact] = useState(false)

  const tree = useMemo(() => {
    const root = entities.find((e) => e.id === rootId) || entities[0]
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
          const child = entities.find((e) => e.id === link.targetId)
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
  }, [entities, rootId, depth])

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const meta = ENTITY_TYPE_META[node.entity.type]
    const isExpanded = expandedNodes.has(node.entity.id) || level === 0
    const hasChildren = node.children.length > 0

    return (
      <div key={node.entity.id} className="relative">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: level * 0.05 }}
          className="flex items-center"
          style={{ paddingLeft: `${level * 28}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.entity.id)}
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
            <span className="rounded bg-muted px-1.5 py-0 text-[9px] uppercase tracking-wide text-ink-faint">
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
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
          onChange={(e) => setRootId(e.target.value)}
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
          <span className="text-[11px] text-ink-mute">Depth</span>
          <input
            type="range"
            min={1}
            max={5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-20 accent-saffron"
          />
          <span className="font-mono text-[11px] text-ink">{depth}</span>
        </div>

        <Divider />

        <ToolbarBtn icon={Plus} label="Add child" onClick={() => toast.info('Add child node')} />
        <ToolbarBtn icon={Edit3} label="Rename" onClick={() => toast.info('Rename')} />
        <ToolbarBtn icon={Trash2} label="Delete" onClick={() => toast.info('Delete')} />
        <ToolbarBtn icon={Undo2} label="Undo" onClick={() => toast.info('Undo')} />
        <ToolbarBtn icon={Redo2} label="Redo" onClick={() => toast.info('Redo')} />

        <div className="flex-1" />

        <button
          onClick={() => setCompact(!compact)}
          className={cn(
            'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
            compact ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
          )}
        >
          Compact
        </button>
        <ToolbarBtn icon={RefreshCw} label="Sync" onClick={() => toast.success('Synced with graph')} />
        <ToolbarBtn icon={Download} label="Export PNG" onClick={() => toast.success('Mind map exported')} />
      </div>

      {/* Hint */}
      <div className="border-b border-border bg-muted/30 px-5 py-1.5 text-[11px] text-ink-faint">
        <kbd className="rounded border border-border bg-background px-1 font-mono">Tab</kbd> add child ·{' '}
        <kbd className="rounded border border-border bg-background px-1 font-mono">F2</kbd> rename ·{' '}
        <kbd className="rounded border border-border bg-background px-1 font-mono">Del</kbd> delete
      </div>

      {/* Canvas */}
      <div className="flex-1 canvas-grid overflow-auto p-6">
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
      <div className="border-t border-border bg-card/50 px-5 py-2 text-[11px] text-ink-faint">
        {tree ? `Root: ${tree.entity.name} · ${tree.children.length} direct children · depth ${depth}` : 'No data'}
      </div>
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />
}
