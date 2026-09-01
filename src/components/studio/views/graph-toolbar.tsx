'use client'

import {
  Circle,
  GitFork,
  Layers,
  Focus,
  Camera,
  RotateCcw,
  RotateCw,
  Download,
  MoreHorizontal,
  HelpCircle,
} from 'lucide-react'
import { ToggleButtonGroup, Divider } from '../ui/shared-primitives'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type LayoutType = 'force' | 'circular' | 'hierarchical'

interface ToolbarBtnProps {
  icon: typeof Focus
  label: string
  /** Contextual help shown on hover (progressive disclosure). */
  help?: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}

/** Icon button with optional tooltip for progressive disclosure. */
export const ToolbarBtn = ({
  icon: Icon,
  label,
  help,
  active,
  onClick,
  disabled,
}: ToolbarBtnProps) => {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-md px-2 py-1.5 text-label font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  if (!help) return button

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-52 text-center">
          <span className="flex items-center justify-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {help}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface GraphToolbarProps {
  layout: LayoutType
  onLayoutChange: (layout: LayoutType) => void
  focusMode: boolean
  onToggleFocusMode: () => void
  onSaveSnapshot: () => void
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
              'flex min-h-[44px] min-w-[44px] items-center gap-1 rounded px-2 py-1 text-label font-medium capitalize transition-colors focus-ring',
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
        help="Save the current layout, selection, and focus mode for later"
        onClick={onSaveSnapshot}
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
