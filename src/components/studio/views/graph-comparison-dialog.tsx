'use client'

import { Overlay } from '../ui/overlay'
import { GitCompare, X, PlusCircle, MinusCircle, CheckCircle2, Sliders, Layers } from 'lucide-react'
import { edgeIdentity, type GraphSnapshotDiff } from '@/lib/studio/graph-snapshot'
import { translate as graphT } from '@/lib/i18n/messages/graph'
import { useRef } from 'react'

interface GraphComparisonDialogProps {
  open: boolean
  onClose: () => void
  diff: GraphSnapshotDiff | null
}

/** Locale-aware snapshot timestamp formatting (Intl, module-scope). */
const SNAPSHOT_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Formats a delta value with an explicit sign for readability. */
const formatDelta = (value: number): string =>
  value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)

/** Whether a zoom delta is large enough to report as a change. */
const ZOOM_EPSILON = 0.001
/** Whether a pan delta (per axis) is large enough to report as a change. */
const PAN_EPSILON = 0.5

export const GraphComparisonDialog = ({
  open,
  onClose,
  diff,
}: GraphComparisonDialogProps) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  if (!diff) return null

  // `timestamp` is schema-permissive (any string) because localStorage is
  // user-writable; an unparseable value must not crash the dialog's render.
  const parsedTimestamp = new Date(diff.snapshotTimestamp)
  const formattedDate = Number.isNaN(parsedTimestamp.getTime())
    ? diff.snapshotTimestamp
    : SNAPSHOT_DATE_FORMAT.format(parsedTimestamp)
  const zoomUnchanged = Math.abs(diff.zoomDelta) <= ZOOM_EPSILON
  const panUnchanged =
    Math.abs(diff.panDelta.x) <= PAN_EPSILON && Math.abs(diff.panDelta.y) <= PAN_EPSILON
  const focusLabel = (value: boolean): string =>
    value ? graphT('graph.comparison.on') : graphT('graph.comparison.off')

  const hasTopologyChanges =
    diff.addedEntities.length > 0 ||
    diff.removedEntities.length > 0 ||
    diff.addedEdges.length > 0 ||
    diff.removedEdges.length > 0

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="center"
      aria-labelledby="graph-comparison-title"
      aria-describedby="graph-comparison-summary"
      initialFocusRef={closeBtnRef}
      className="p-0 border border-border bg-card shadow-lg"
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-saffron" aria-hidden="true" />
            <h2 id="graph-comparison-title" className="text-body font-serif font-semibold text-ink">
              {graphT('graph.comparison.title')}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label={graphT('graph.comparison.closeAria')}
            className="rounded p-1 text-ink-faint hover:bg-muted hover:text-ink focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4 text-label-lg">
          <p id="graph-comparison-summary" className="text-label text-ink-mute">
            {graphT('graph.comparison.savedOn', formattedDate)}
          </p>

          {/* Layout, focus, selection, and viewport shifts */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-label font-medium text-ink-soft">
              <Sliders className="h-3.5 w-3.5 text-saffron" aria-hidden="true" />
              <span>{graphT('graph.comparison.canvasChanges')}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-label">
              <dt className="text-ink-mute">{graphT('graph.comparison.layout')}</dt>
              <dd>
                {diff.layoutChanged ? (
                  <span className="font-medium text-saffron-deep">
                    {graphT('graph.comparison.connection', diff.previousLayout, diff.currentLayout)}
                  </span>
                ) : (
                  <span className="text-ink-soft">
                    {graphT('graph.comparison.unchanged', diff.currentLayout)}
                  </span>
                )}
              </dd>

              <dt className="text-ink-mute">{graphT('graph.comparison.zoom')}</dt>
              <dd className="font-mono text-ink">
                {zoomUnchanged
                  ? graphT('graph.comparison.unchangedPlain')
                  : formatDelta(diff.zoomDelta)}
              </dd>

              <dt className="text-ink-mute">{graphT('graph.comparison.pan')}</dt>
              <dd className="font-mono text-ink">
                {panUnchanged
                  ? graphT('graph.comparison.unchangedPlain')
                  : graphT(
                      'graph.comparison.panDelta',
                      formatDelta(diff.panDelta.x),
                      formatDelta(diff.panDelta.y),
                    )}
              </dd>

              <dt className="text-ink-mute">{graphT('graph.comparison.focusMode')}</dt>
              <dd>
                {diff.focusModeChanged ? (
                  <span className="font-medium text-saffron-deep">
                    {graphT(
                      'graph.comparison.connection',
                      focusLabel(diff.previousFocusMode),
                      focusLabel(diff.currentFocusMode),
                    )}
                  </span>
                ) : (
                  <span className="text-ink-soft">
                    {graphT('graph.comparison.unchanged', focusLabel(diff.currentFocusMode))}
                  </span>
                )}
              </dd>

              <dt className="text-ink-mute">{graphT('graph.comparison.selection')}</dt>
              <dd>
                {diff.selectionChanged ? (
                  <span className="font-medium text-saffron-deep">
                    {graphT(
                      'graph.comparison.connection',
                      diff.previousSelection?.name ?? graphT('graph.comparison.none'),
                      diff.currentSelection?.name ?? graphT('graph.comparison.none'),
                    )}
                  </span>
                ) : (
                  <span className="text-ink-soft">
                    {graphT(
                      'graph.comparison.unchanged',
                      diff.currentSelection?.name ?? graphT('graph.comparison.none'),
                    )}
                  </span>
                )}
              </dd>
            </dl>
          </div>

          {/* Topology changes */}
          {diff.hasTopologyData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-label">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Layers className="h-3.5 w-3.5 text-saffron" aria-hidden="true" />
                  <span>{graphT('graph.comparison.entityChanges')}</span>
                </span>
                {diff.hasEntityData && (
                  <span className="text-ink-mute">
                    {graphT('graph.comparison.retainedEntities', String(diff.retainedEntityCount))}
                  </span>
                )}
              </div>

              {/* Added entities */}
              {diff.addedEntities.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-emerald-700 dark:text-emerald-400">
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {graphT('graph.comparison.addedEntities', String(diff.addedEntities.length))}
                    </span>
                  </div>
                  <ul className="list-inside list-disc text-label text-ink-soft space-y-0.5 max-h-28 overflow-y-auto">
                    {diff.addedEntities.map((entity) => (
                      <li key={entity.id}>{entity.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Removed entities */}
              {diff.removedEntities.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-red-700 dark:text-red-400">
                    <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {graphT(
                        'graph.comparison.removedEntities',
                        String(diff.removedEntities.length),
                      )}
                    </span>
                  </div>
                  <ul className="list-inside list-disc text-label text-ink-soft space-y-0.5 max-h-28 overflow-y-auto">
                    {diff.removedEntities.map((entity) => (
                      <li key={entity.id}>{entity.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Itemized connections */}
              {diff.addedEdges.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-emerald-700 dark:text-emerald-400">
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {graphT(
                        'graph.comparison.addedConnections',
                        String(diff.addedEdges.length),
                      )}
                    </span>
                  </div>
                  <ul className="text-label text-ink-soft space-y-0.5 max-h-28 overflow-y-auto">
                    {diff.addedEdges.map((edge) => (
                      <li key={edgeIdentity(edge)}>
                        {graphT('graph.comparison.connection', edge.fromName, edge.toName)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {diff.removedEdges.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-red-700 dark:text-red-400">
                    <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {graphT(
                        'graph.comparison.removedConnections',
                        String(diff.removedEdges.length),
                      )}
                    </span>
                  </div>
                  <ul className="text-label text-ink-soft space-y-0.5 max-h-28 overflow-y-auto">
                    {diff.removedEdges.map((edge) => (
                      <li key={edgeIdentity(edge)}>
                        {graphT('graph.comparison.connection', edge.fromName, edge.toName)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The identical-inventory claim only holds when both sections
                  were actually compared; edges-only payloads stay silent. */}
              {!hasTopologyChanges && diff.hasEntityData && diff.hasEdgeData && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/10 p-3 text-label text-ink-soft">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{graphT('graph.comparison.noTopologyChanges')}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-label text-ink-mute">
              {graphT('graph.comparison.noTopologyData')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-5 py-3 bg-muted/10">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-3.5 py-1.5 text-label font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-ring min-h-touch"
          >
            {graphT('graph.comparison.close')}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
