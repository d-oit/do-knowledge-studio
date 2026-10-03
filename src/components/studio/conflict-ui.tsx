'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldConflict } from '@/lib/sync/merge'

interface ConflictUIProps {
  conflicts: FieldConflict[]
  onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void
  onDismiss: () => void
}

/** Conflict resolution UI for choosing between local and remote field values during sync. */
export function ConflictUI({ conflicts, onResolve, onDismiss }: ConflictUIProps) {
  const [resolutions, setResolutions] = useState<Map<string, 'local' | 'remote'>>(
    () => new Map(conflicts.map((c) => [`${c.entityId}:${c.field}`, c.winner])),
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
    setResolutions(new Map(conflicts.map((c) => [`${c.entityId}:${c.field}`, choice])))
  }, [conflicts])

  const handleConfirm = useCallback(() => {
    onResolve(resolutions)
  }, [resolutions, onResolve])

  if (conflicts.length === 0) return null

  return (
    <div className="rounded-lg border border-warning-border bg-warning-soft">
      <div className="flex items-center gap-2 border-b border-warning-border px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="text-[13px] font-medium text-warning-foreground">
          {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected
        </span>
        <div className="flex-1" />
        <button
          onClick={() => { handleResolveAll('local') }}
          className="rounded px-2 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/10 min-h-[44px] focus-ring"
        >
          Keep all local
        </button>
        <button
          onClick={() => { handleResolveAll('remote') }}
          className="rounded px-2 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/10 min-h-[44px] focus-ring"
        >
          Keep all remote
        </button>
      </div>

      <div className="max-h-[300px] divide-y divide-warning-border overflow-y-auto">
        {conflicts.map((conflict) => {
          const key = `${conflict.entityId}:${conflict.field}`
          const resolution = resolutions.get(key) ?? conflict.winner
          const isExpanded = expandedId === key

          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : key) }}
                  className="flex min-h-[44px] items-center gap-1.5 text-[12px] font-medium text-warning-foreground focus-ring"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <span className="font-mono">{conflict.entityType}</span>
                  <span className="text-warning">·</span>
                  <span>{conflict.field}</span>
                </button>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { handleResolution(key, 'local') }}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium transition-colors min-h-[44px] focus-ring',
                      resolution === 'local'
                        ? 'bg-warning text-warning-on'
                        : 'text-warning hover:bg-warning/10',
                    )}
                  >
                    Local
                  </button>
                  <button
                    onClick={() => { handleResolution(key, 'remote') }}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium transition-colors min-h-[44px] focus-ring',
                      resolution === 'remote'
                        ? 'bg-warning text-warning-on'
                        : 'text-warning hover:bg-warning/10',
                    )}
                  >
                    Remote
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded border border-border bg-background p-2">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      Local
                    </div>
                    <div className="text-[12px] text-ink break-words">
                      {formatValue(conflict.localValue)}
                    </div>
                  </div>
                  <div className="rounded border border-border bg-background p-2">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      Remote
                    </div>
                    <div className="text-[12px] text-ink break-words">
                      {formatValue(conflict.remoteValue)}
                    </div>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="mt-1.5 text-[11px] text-ink-faint">
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
          className="flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
        <button
          onClick={handleConfirm}
          className="flex min-h-[44px] items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
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
