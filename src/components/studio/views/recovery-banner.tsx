'use client'

import { useCallback, useState } from 'react'
import { History, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as t } from '@/lib/i18n/messages/announce'
import {
  restoreFromRecovery,
  type RecoverySnapshotSummary,
} from '@/lib/studio/recovery-helpers'
import { cn } from '@/lib/utils'

/** Shared action styling: 44px floor and a visible keyboard focus ring. */
const ACTION_CLASS = cn(
  'flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5',
  'text-label font-medium text-saffron-deep transition-colors',
  'hover:bg-saffron-soft focus-ring',
)

/** Dismissible control styling: 44px floor and a visible focus ring. */
const DISMISS_CLASS = cn(
  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md',
  'text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring',
)

/**
 * Non-destructive session dismissal.
 *
 * Mirrors the quarantine banner's rule: hiding the offer must never destroy the
 * snapshot, so this only sets local state. A reload brings the offer back,
 * because the bytes are still in localStorage.
 */
const HideForSessionButton = ({ onHide }: { onHide: () => void }) => (
  <button type="button" onClick={onHide} aria-label={t('announce.restoreDismiss')} className={DISMISS_CLASS}>
    <X aria-hidden="true" className="h-4 w-4" />
  </button>
)

/**
 * Banner offering to restore the corpus that existed before the last import.
 *
 * The pre-import snapshot was always written but had no UI, so a user who
 * replaced their library had no way back. This is mounted above the view router
 * so it is reachable from any view, not only from the Export view the import
 * happened in.
 */
export const RecoveryBanner = ({ summary }: { summary: RecoverySnapshotSummary }) => {
  const announce = useAnnouncer()
  const [hidden, setHidden] = useState(false)

  const handleRestore = useCallback(() => {
    /** The result. */
    const result = restoreFromRecovery()
    if (result.success) {
      announce(t('announce.restoreSucceeded'))
      toast.success(t('announce.restoreSucceeded'))
      setHidden(true)
    } else {
      announce(t('announce.restoreFailed'))
      toast.error(t('announce.restoreFailed'), { description: result.error })
    }
  }, [announce])

  if (hidden) return null

  const summaryText = `${summary.entityCount} ${summary.entityCount === 1 ? 'entity' : 'entities'} and ${summary.claimCount} ${summary.claimCount === 1 ? 'claim' : 'claims'}`

  return (
    <section
      role="alert"
      aria-labelledby="recovery-restore-title"
      data-testid="recovery-banner"
      className={cn(
        'mb-6 rounded-lg border border-saffron/30 bg-saffron-soft/40 p-4',
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      )}
    >
      <div className="flex gap-3">
        <History aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-saffron-deep" />
        <div>
          <h2 id="recovery-restore-title" className="font-serif text-[15px] font-semibold text-ink">
            {t('announce.restoreTitle')}
          </h2>
          <p className="mt-1 text-caption text-ink-mute">
            {t('announce.restoreBody', summaryText)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" onClick={handleRestore} className={ACTION_CLASS}>
          {t('announce.restoreAction')}
        </button>
        <HideForSessionButton onHide={() => { setHidden(true) }} />
      </div>
    </section>
  )
}