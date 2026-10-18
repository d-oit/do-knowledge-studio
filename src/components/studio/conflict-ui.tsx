'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConflictResolutionKey, type FieldConflict } from '@/lib/sync/merge'
import { translate as t } from '@/lib/i18n/messages/sync'

interface ConflictUIProps {
  conflicts: FieldConflict[]
  onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void
  onDismiss: () => void
}

/** Conflict resolution UI for choosing between local and remote field values during sync. */
export function ConflictUI({ conflicts, onResolve, onDismiss }: ConflictUIProps) {
  const [resolutions, setResolutions] = useState<Map<string, 'local' | 'remote'>>(
    () => new Map(conflicts.map((conflict) => [getConflictResolutionKey(conflict), conflict.winner])),
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleResolution = useCallback((key: string, choice: 'local' | 'remote') => {
    setResolutions((prev) => {
      const next = new Map(prev)
      next.set(key, choice)
      return next
    })
  }, [])

  const handleResolveAll = useCallback((choice: 'local' | 'remote') => {
    setResolutions(new Map(conflicts.map((conflict) => [getConflictResolutionKey(conflict), choice])))
  }, [conflicts])

  const handleConfirm = useCallback(() => {
    onResolve(resolutions)
  }, [resolutions, onResolve])

  if (conflicts.length === 0) return null
  const allDeletionConflicts = conflicts.every((conflict) => conflict.field === '__delete')

  return (
    <div className="rounded-lg border border-warning-border bg-warning-soft">
      <div className="flex items-center gap-2 border-b border-warning-border px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="text-body-sm font-medium text-warning-foreground">
          {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected
        </span>
        <div className="flex-1" />
        <button
          onClick={() => { handleResolveAll('local') }}
          className="rounded px-2 py-1 text-label font-medium text-warning transition-colors hover:bg-warning/10 min-h-touch focus-ring"
        >
          {allDeletionConflicts ? t('sync.conflict.restoreAllEditedRecords') : 'Keep all local'}
        </button>
        <button
          onClick={() => { handleResolveAll('remote') }}
          className="rounded px-2 py-1 text-label font-medium text-warning transition-colors hover:bg-warning/10 min-h-touch focus-ring"
        >
          {allDeletionConflicts ? t('sync.conflict.keepAllDeletions') : 'Keep all remote'}
        </button>
      </div>

      <div className="max-h-[300px] divide-y divide-warning-border overflow-y-auto">
        {conflicts.map((conflict) => {
          const key = getConflictResolutionKey(conflict)
          const isDeletionConflict = conflict.field === '__delete'
          const resolution = resolutions.get(key) ?? conflict.winner
          const isExpanded = expandedId === key

          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : key) }}
                  className="flex min-h-touch items-center gap-1.5 text-label-lg font-medium text-warning-foreground focus-ring"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <span className="font-mono">{conflict.entityType}</span>
                  <span className="text-warning">·</span>
                  <span>{isDeletionConflict ? t('sync.conflict.recordDeletion') : conflict.field}</span>
                </button>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { handleResolution(key, 'local') }}
                    className={cn(
                      'rounded px-2 py-0.5 text-label font-medium transition-colors min-h-touch focus-ring',
                      resolution === 'local'
                        ? 'bg-warning text-warning-on'
                        : 'text-warning hover:bg-warning/10',
                    )}
                  >
                    {isDeletionConflict ? t('sync.conflict.restoreEditedRecord') : 'Local'}
                  </button>
                  <button
                    onClick={() => { handleResolution(key, 'remote') }}
                    className={cn(
                      'rounded px-2 py-0.5 text-label font-medium transition-colors min-h-touch focus-ring',
                      resolution === 'remote'
                        ? 'bg-warning text-warning-on'
                        : 'text-warning hover:bg-warning/10',
                    )}
                  >
                    {isDeletionConflict ? t('sync.conflict.keepDeletion') : 'Remote'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded border border-border bg-background p-2">
                    <div className="mb-1 text-caption font-medium uppercase tracking-wide text-ink-faint">
                      {isDeletionConflict ? t('sync.conflict.editedRecord') : 'Local'}
                    </div>
                    <div className="text-label-lg text-ink break-words">
                      {formatConflictValue(conflict, 'local')}
                    </div>
                  </div>
                  <div className="rounded border border-border bg-background p-2">
                    <div className="mb-1 text-caption font-medium uppercase tracking-wide text-ink-faint">
                      {isDeletionConflict ? t('sync.conflict.deletion') : 'Remote'}
                    </div>
                    <div className="text-label-lg text-ink break-words">
                      {formatConflictValue(conflict, 'remote')}
                    </div>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="mt-1.5 text-label text-ink-faint">
                  {conflict.reason}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-warning-border px-4 py-3">
        <button
          onClick={onDismiss}
          className="flex min-h-touch items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
        <button
          onClick={handleConfirm}
          className="flex min-h-touch items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-label-lg font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          <Check className="h-3.5 w-3.5" />
          Apply resolutions
        </button>
      </div>
    </div>
  )
}

/** Formats a conflict value into a human-readable string for display. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value || '(empty)'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(empty)'
  return String(value)
}

const formatConflictValue = (conflict: FieldConflict, side: 'local' | 'remote'): string => {
  if (conflict.field !== '__delete') {
    return formatValue(side === 'local' ? conflict.localValue : conflict.remoteValue)
  }
  if (side === 'remote') return t('sync.conflict.deleted')
  const value = conflict.localValue
  if (typeof value === 'object' && value !== null) {
    if ('name' in value && typeof value.name === 'string') return value.name
    if ('statement' in value && typeof value.statement === 'string') return value.statement
  }
  return t('sync.conflict.editedRecord')
}
