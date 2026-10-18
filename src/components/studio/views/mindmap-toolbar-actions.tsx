import { Download, Edit3, Plus, Redo2, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate as t } from '@/lib/i18n/messages/mindmap'
import { Divider, ToolbarBtn } from '../ui/shared-primitives'

interface MindMapToolbarActionsProps {
  focusedNodeId: string | null
  canUndo: boolean
  canRedo: boolean
  compact: boolean
  onAddChild: (parentId: string) => void
  onRename: (entityId: string) => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleCompact: () => void
  onSync: () => void
  onExportPng: () => void
}

/** Shared action controls for the mind-map toolbar. */
export const MindMapToolbarActions = ({
  focusedNodeId,
  canUndo,
  canRedo,
  compact,
  onAddChild,
  onRename,
  onDelete,
  onUndo,
  onRedo,
  onToggleCompact,
  onSync,
  onExportPng,
}: MindMapToolbarActionsProps) => {
  const compactLabel = compact
    ? t('mindmap.density.comfortable')
    : t('mindmap.density.compact')
  const undoLabel = t('mindmap.toolbar.undo')
  const redoLabel = t('mindmap.toolbar.redo')

  return (
    <>
      <Divider />
      <ToolbarBtn
        icon={Plus}
        label={t('mindmap.toolbar.addChild')}
        labelClassName="hidden md:inline"
        onClick={() => { if (focusedNodeId) onAddChild(focusedNodeId) }}
      />
      <ToolbarBtn
        icon={Edit3}
        label={t('mindmap.toolbar.rename')}
        labelClassName="hidden md:inline"
        onClick={() => { if (focusedNodeId) onRename(focusedNodeId) }}
      />
      <ToolbarBtn
        icon={Trash2}
        label={t('mindmap.toolbar.delete')}
        labelClassName="hidden md:inline"
        onClick={onDelete}
      />
      <ToolbarBtn
        icon={Undo2}
        label={undoLabel}
        labelClassName="hidden md:inline"
        disabled={!canUndo}
        disabledTitle={t('mindmap.toolbar.disabledHint', undoLabel)}
        onClick={onUndo}
      />
      <ToolbarBtn
        icon={Redo2}
        label={redoLabel}
        labelClassName="hidden md:inline"
        disabled={!canRedo}
        disabledTitle={t('mindmap.toolbar.disabledHint', redoLabel)}
        onClick={onRedo}
      />
      <div className="flex-1" />

      <button
        onClick={onToggleCompact}
        aria-pressed={compact}
        aria-label={t('mindmap.density.toggle')}
        data-testid="mindmap-compact-toggle"
        className={cn(
          'rounded-md px-2 py-1.5 text-label font-medium transition-colors min-h-touch focus-ring',
          compact ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
        )}
      >
        {compactLabel}
      </button>
      <ToolbarBtn
        icon={RefreshCw}
        label={t('mindmap.toolbar.sync')}
        labelClassName="hidden md:inline"
        onClick={onSync}
      />
      <ToolbarBtn
        icon={Download}
        label={t('mindmap.toolbar.exportPng')}
        labelClassName="hidden md:inline"
        onClick={onExportPng}
      />
    </>
  )
}
