'use client'

import { memo } from 'react'
import { Eye, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import type { ImportPreview } from './export-types'
import { translate } from '@/lib/i18n/messages/import'

interface ImportPreviewDialogProps {
  state: { preview: ImportPreview | null }
  actions: {
    close: (preview: ImportPreview | null) => void
    confirm: () => void
  }
}

/** Maximum stub/conflict names listed before collapsing into an “…and N more”. */
const MAX_LISTED_NAMES = 8

/** Dialog showing entity and claim counts before confirming a destructive import. */
export const ImportPreviewDialog = memo(function ImportPreviewDialog({
  state,
  actions,
}: ImportPreviewDialogProps) {
  const { preview: importPreview } = state
  const { close: setImportPreview, confirm: handleConfirmImport } = actions
  const reducedMotion = useReducedMotion()

  if (!importPreview) return null

  return (
    <Overlay
      open={Boolean(importPreview)}
      onClose={() => { setImportPreview(null) }}
      aria-label={translate('import.ariaLabel')}
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
            <h3 className="font-serif text-body-lg font-semibold text-ink">{translate('import.title')}</h3>
            <p className="text-label-lg text-ink-mute">{translate('import.subtitle')}</p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-ink-mute">{translate('import.entities')}</span>
            <span className="font-semibold text-ink">{importPreview.entityCount}</span>
          </div>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-ink-mute">{translate('import.claims')}</span>
            <span className="font-semibold text-ink">{importPreview.claimCount}</span>
          </div>
          {(importPreview.stubNames?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-2 dark:border-sky-900 dark:bg-sky-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="text-label text-sky-700 dark:text-sky-300">
                <p>{translate('import.stubs', String(importPreview.stubNames?.length ?? 0))}</p>
                <p className="mt-0.5 font-medium">
                  {(importPreview.stubNames ?? []).slice(0, MAX_LISTED_NAMES).join(', ')}
                  {(importPreview.stubNames?.length ?? 0) > MAX_LISTED_NAMES
                    ? ` ${translate('import.moreNames', String((importPreview.stubNames?.length ?? 0) - MAX_LISTED_NAMES))}`
                    : ''}
                </p>
              </div>
            </div>
          )}
          {(importPreview.conflicts?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-label text-amber-700 dark:text-amber-300">
                <p>{translate('import.conflicts', String(importPreview.conflicts?.length ?? 0))}</p>
                <p className="mt-0.5 font-medium">
                  {(importPreview.conflicts ?? []).slice(0, MAX_LISTED_NAMES).join(', ')}
                  {(importPreview.conflicts?.length ?? 0) > MAX_LISTED_NAMES
                    ? ` ${translate('import.moreNames', String((importPreview.conflicts?.length ?? 0) - MAX_LISTED_NAMES))}`
                    : ''}
                </p>
              </div>
            </div>
          )}
          {importPreview.duplicateIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-label text-amber-700 dark:text-amber-300">
                {translate('import.duplicates', String(importPreview.duplicateIds.length))}
              </p>
            </div>
          )}
        </div>

        <p className="mb-4 text-label-lg text-ink-mute">
          {translate('import.body')}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setImportPreview(null) }}
            className="rounded-md border border-border px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            {translate('import.cancel')}
          </button>
          <button
            onClick={handleConfirmImport}
            className="rounded-md bg-primary px-4 py-1.5 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            {translate('import.confirm')}
          </button>
        </div>
      </motion.div>
    </Overlay>
  )
})
