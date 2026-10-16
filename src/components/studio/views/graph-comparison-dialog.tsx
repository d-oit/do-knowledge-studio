'use client'

import { Overlay } from '../ui/overlay'
import { GitCompare, X, PlusCircle, MinusCircle, CheckCircle2, Sliders } from 'lucide-react'
import type { GraphSnapshotDiff } from '@/lib/studio/graph-snapshot'
import { useRef } from 'react'

interface GraphComparisonDialogProps {
  open: boolean
  onClose: () => void
  diff: GraphSnapshotDiff | null
}

export const GraphComparisonDialog = ({
  open,
  onClose,
  diff,
}: GraphComparisonDialogProps) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  if (!diff) return null

  const formattedDate = new Date(diff.snapshotTimestamp).toLocaleString()

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="center"
      aria-labelledby="graph-comparison-title"
      aria-describedby="graph-comparison-desc"
      initialFocusRef={closeBtnRef}
      className="p-0 border border-border bg-card shadow-lg"
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-saffron" aria-hidden="true" />
            <h2 id="graph-comparison-title" className="text-body font-serif font-semibold text-ink">
              Graph Revision Comparison
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close comparison dialog"
            className="rounded p-1 text-ink-faint hover:bg-muted hover:text-ink focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div id="graph-comparison-desc" className="overflow-y-auto p-5 space-y-4 text-label-lg">
          <div className="text-label text-ink-mute">
            Comparing live graph against snapshot saved on <span className="font-mono text-ink">{formattedDate}</span>.
          </div>

          {/* Layout & Viewport Shifts */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-label font-medium text-ink-soft">
              <Sliders className="h-3.5 w-3.5 text-saffron" aria-hidden="true" />
              <span>Canvas & Viewport Changes</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-label">
              <div>
                <span className="text-ink-mute">Layout: </span>
                {diff.layoutChanged ? (
                  <span className="font-medium text-saffron-deep">
                    {diff.previousLayout} → {diff.currentLayout}
                  </span>
                ) : (
                  <span className="text-ink-soft">Unchanged ({diff.currentLayout})</span>
                )}
              </div>
              <div>
                <span className="text-ink-mute">Zoom factor: </span>
                <span className="font-mono text-ink">
                  {diff.zoomDelta >= 0 ? `+${diff.zoomDelta.toFixed(2)}` : diff.zoomDelta.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Topology Changes */}
          {diff.hasTopologyData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-label">
                <span className="font-medium text-ink">Entity & Connection Changes</span>
                <span className="text-ink-mute">{diff.retainedEntityCount} retained entities</span>
              </div>

              {/* Added Entities */}
              {diff.addedEntities.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-emerald-700 dark:text-emerald-400">
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Added Entities ({diff.addedEntities.length})</span>
                  </div>
                  <ul className="list-inside list-disc text-label text-ink-soft space-y-0.5 max-h-28 overflow-y-auto">
                    {diff.addedEntities.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Removed Entities */}
              {diff.removedEntities.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-label font-medium text-red-700 dark:text-red-400">
                    <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Removed Entities ({diff.removedEntities.length})</span>
                  </div>
                  <div className="text-label text-ink-mute">
                    {diff.removedEntities.length} entities from snapshot are no longer in graph.
                  </div>
                </div>
              )}

              {/* Connections */}
              <div className="grid grid-cols-2 gap-2 text-label">
                <div className="rounded border border-border p-2 bg-muted/20">
                  <span className="text-ink-mute">Added edges: </span>
                  <span className="font-medium text-ink">{diff.addedEdges.length}</span>
                </div>
                <div className="rounded border border-border p-2 bg-muted/20">
                  <span className="text-ink-mute">Removed edges: </span>
                  <span className="font-medium text-ink">{diff.removedEdges.length}</span>
                </div>
              </div>

              {diff.addedEntities.length === 0 &&
                diff.removedEntities.length === 0 &&
                diff.addedEdges.length === 0 &&
                diff.removedEdges.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/10 p-3 text-label text-ink-soft">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Graph entities and connections are identical to snapshot.</span>
                  </div>
                )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-label text-ink-mute">
              Saved snapshot predates topology tracking. Layout and viewport comparison are displayed above.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-5 py-3 bg-muted/10">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-3.5 py-1.5 text-label font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-ring min-h-touch"
          >
            Close
          </button>
        </div>
      </div>
    </Overlay>
  )
}
