'use client'

import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import { translate as exportT } from '@/lib/i18n/messages/export'
import {
  describeRecoverySnapshot,
  restoreFromRecovery,
  subscribeToRecoveryAvailability,
  type RecoverySnapshotSummary,
} from '@/lib/studio/recovery-helpers'
import { ConfirmDialog } from '@/components/studio/ui/shared-primitives'
import { cn } from '@/lib/utils'

/** Surface displaying pre-import recovery snapshot status and restore controls in ExportView. */
export const RecoveryPanel = () => {
  const announce = useAnnouncer()
  const [summary, setSummary] = useState<RecoverySnapshotSummary | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const refreshSummary = useCallback(() => {
    setSummary(describeRecoverySnapshot())
  }, [])

  useEffect(() => {
    refreshSummary()
    return subscribeToRecoveryAvailability(refreshSummary)
  }, [refreshSummary])

  const handleRestoreConfirm = useCallback(() => {
    setShowConfirm(false)
    const result = restoreFromRecovery()
    if (result.success) {
      if (result.snapshotCleared) {
        announce(announceT('announce.restoreSucceeded'))
        toast.success(announceT('announce.restoreSucceeded'))
      } else {
        announce(announceT('announce.restoreSucceededSnapshotKept'))
        toast.warning(announceT('announce.restoreSucceededSnapshotKept'), {
          description: announceT('announce.restoreSnapshotKeptHint'),
        })
      }
      refreshSummary()
    } else {
      announce(announceT('announce.restoreFailed'))
      toast.error(announceT('announce.restoreFailed'), { description: result.error })
    }
  }, [announce, refreshSummary])

  if (!summary) return null

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(summary.timestamp))

  const summaryText = `${summary.entityCount} ${summary.entityCount === 1 ? 'entity' : 'entities'} and ${summary.claimCount} ${summary.claimCount === 1 ? 'claim' : 'claims'}`

  const confirmBodyCopy = summary.isImmediatePreImport
    ? announceT('announce.restoreConfirmBodyImmediate', formattedDate, summaryText)
    : announceT('announce.restoreConfirmBodyStale', formattedDate, summaryText)

  return (
    <div
      data-testid="recovery-panel"
      className="mt-8 rounded-xl border border-saffron/30 bg-saffron-soft/20 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-body font-semibold text-ink">
                {exportT('export.recovery.title')}
              </h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-caption font-medium',
                  summary.isImmediatePreImport
                    ? 'bg-saffron/20 text-saffron-deep'
                    : 'bg-muted text-ink-mute',
                )}
              >
                {summary.isImmediatePreImport
                  ? exportT('export.recovery.immediateTag')
                  : exportT('export.recovery.staleTag')}
              </span>
            </div>
            <p className="mt-1 text-caption text-ink-mute">
              Captured {formattedDate} · {summaryText}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setShowConfirm(true) }}
          className="flex min-h-touch items-center justify-center gap-1.5 rounded-md bg-saffron px-4 py-2 text-label-lg font-medium text-white transition-colors hover:bg-saffron-deep focus-ring"
        >
          {exportT('export.recovery.restoreBtn')}
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleRestoreConfirm}
        onCancel={() => { setShowConfirm(false) }}
        title={announceT('announce.restoreConfirmTitle')}
        body={confirmBodyCopy}
        confirmLabel={announceT('announce.restoreAction')}
        cancelLabel={announceT('announce.restoreDismiss')}
        destructive
      />
    </div>
  )
}
