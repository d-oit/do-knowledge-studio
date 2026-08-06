'use client'

import { memo } from 'react'
import { Eye, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import type { ImportPreview } from './export-helpers'

interface ImportPreviewDialogProps {
  importPreview: ImportPreview | null
  setImportPreview: (preview: ImportPreview | null) => void
  handleConfirmImport: () => void
}

/** Dialog showing entity and claim counts before confirming a destructive import. */
export const ImportPreviewDialog = memo(function ImportPreviewDialog({
  importPreview,
  setImportPreview,
  handleConfirmImport,
}: ImportPreviewDialogProps) {
  const reducedMotion = useReducedMotion()

  if (!importPreview) return null

  return (
    <Overlay
      open={!!importPreview}
      onClose={() => { setImportPreview(null) }}
      aria-label="Confirm import"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] rounded-xl border border-border bg-popover p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-saffron-soft text-saffron-deep">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif text-[15px] font-semibold text-ink">Import preview</h3>
            <p className="text-[12px] text-ink-mute">Review before replacing your library.</p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-mute">Entities</span>
            <span className="font-semibold text-ink">{importPreview.entityCount}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-mute">Claims</span>
            <span className="font-semibold text-ink">{importPreview.claimCount}</span>
          </div>
          {importPreview.duplicateIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-label text-amber-700 dark:text-amber-300">
                {importPreview.duplicateIds.length} existing {importPreview.duplicateIds.length === 1 ? 'entity' : 'entities'} will be replaced (matching IDs detected).
              </p>
            </div>
          )}
        </div>

        <p className="mb-4 text-[12px] text-ink-mute">
          This will replace all current entities and claims. A snapshot is taken so you can undo if something goes wrong.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setImportPreview(null) }}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            className="rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            Confirm import
          </button>
        </div>
      </motion.div>
    </Overlay>
  )
})
