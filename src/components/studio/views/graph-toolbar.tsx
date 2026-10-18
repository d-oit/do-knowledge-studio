'use client'

import {
  Circle,
  GitFork,
  Layers,
  Focus,
  Camera,
  GitCompare,
  History,
  Trash2,
  RotateCcw,
  RotateCw,
  Download,
  MoreHorizontal,
} from 'lucide-react'
import { ToolbarBtn, ToggleButtonGroup, Divider } from '../ui/shared-primitives'
import { cn } from '@/lib/utils'

import type { GraphLayout } from '@/lib/studio/graph-snapshot'

/** Re-exported for callers that only need the layout union. */
export type LayoutType = GraphLayout


interface GraphToolbarProps {
  layout: LayoutType
  onLayoutChange: (layout: LayoutType) => void
  focusMode: boolean
  onToggleFocusMode: () => void
  onSaveSnapshot: () => void
  onRestoreSnapshot: () => void
  onClearSnapshot: () => void
  onCompareSnapshot: () => void
  /** Whether a restorable snapshot is currently stored. */
  hasSnapshot: boolean
  showMore: boolean
  onToggleShowMore: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExportPng: () => void
  nodeCount: number
  edgeCount: number
}

/** Toolbar for the knowledge graph view with layout switching, focus mode, and history actions. */
export const GraphToolbar = ({
  layout,
  onLayoutChange,
  focusMode,
  onToggleFocusMode,
  onSaveSnapshot,
  onRestoreSnapshot,
  onClearSnapshot,
  onCompareSnapshot,
  hasSnapshot,
  showMore,
  onToggleShowMore,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPng,
  nodeCount,
  edgeCount,
}: GraphToolbarProps) => {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card/50 px-5 py-2.5"
      role="toolbar"
      aria-label="Graph controls"
    >
      <ToggleButtonGroup label="Layout">
        {(['force', 'circular', 'hierarchical'] as LayoutType[]).map((l) => (
          <button
            key={l}
            onClick={() => {
              onLayoutChange(l)
            }}
            aria-pressed={layout === l}
            className={cn(
              'flex min-h-touch min-w-touch items-center gap-1 rounded px-2 py-1 text-label font-medium capitalize transition-colors focus-ring',
              layout === l
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-ink-mute hover:text-ink',
            )}
          >
            {l === 'force' && <GitFork className="h-3 w-3" />}
            {l === 'circular' && <Circle className="h-3 w-3" />}
            {l === 'hierarchical' && <Layers className="h-3 w-3" />}
            {l}
          </button>
        ))}
      </ToggleButtonGroup>

      <Divider />

      <ToolbarBtn
        icon={Focus}
        label="Focus neighborhood"
        help="Show only the selected entity and its direct connections"
        active={focusMode}
        onClick={onToggleFocusMode}
      />
      <ToolbarBtn
        icon={Camera}
        label="Save snapshot"
        help="Save the current layout, selection, focus mode, and viewport for later"
        onClick={onSaveSnapshot}
      />
      <ToolbarBtn
        icon={History}
        label="Restore snapshot"
        help={hasSnapshot ? 'Return the canvas to the last saved snapshot' : 'No snapshot saved yet'}
        disabled={!hasSnapshot}
        onClick={onRestoreSnapshot}
      />
      <ToolbarBtn
        icon={GitCompare}
        label="Compare revision"
        help={hasSnapshot ? 'Compare live graph changes against the saved snapshot' : 'No snapshot saved yet'}
        disabled={!hasSnapshot}
        onClick={onCompareSnapshot}
      />
      <ToolbarBtn
        icon={Trash2}
        label="Clear snapshot"
        help={hasSnapshot ? 'Discard the saved snapshot' : 'No snapshot saved yet'}
        disabled={!hasSnapshot}
        onClick={onClearSnapshot}
      />

      <ToolbarBtn
        icon={MoreHorizontal}
        label="More controls"
        active={showMore}
        onClick={onToggleShowMore}
      />
      {showMore && (
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-1">
          <ToolbarBtn
            icon={RotateCcw}
            label="Undo"
            help="Step back through entity edits"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolbarBtn
            icon={RotateCw}
            label="Redo"
            help="Reapply the last undone edit"
            disabled={!canRedo}
            onClick={onRedo}
          />
          <ToolbarBtn
            icon={Download}
            label="Export PNG"
            help="Download the current graph view as a PNG image"
            onClick={onExportPng}
          />
        </div>
      )}

      <div className="flex-1" />

      <span className="hidden text-label text-ink-faint sm:inline">
        {nodeCount} nodes · {edgeCount} edges
      </span>
    </div>
  )
}
