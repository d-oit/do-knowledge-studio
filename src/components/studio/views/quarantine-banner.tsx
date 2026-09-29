'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as t } from '@/lib/i18n/messages/announce'
import { describeQuarantine, clearQuarantine, type QuarantineRecord } from '@/lib/studio/hydration-quarantine'
import { cn } from '@/lib/utils'

/**
 * Banner offering a preserved payload the store refused to hydrate.
 *
 * This is the user-visible half of the recovery path (Plan 158 P0-3). The
 * store quarantines a payload it cannot validate so a later write cannot
 * destroy it, but bytes sitting in localStorage are not a recovery flow — the
 * user has to be told and given a way out.
 */
export const QuarantineBanner = ({ record }: { record: QuarantineRecord }) => {
  const announce = useAnnouncer()
  const [dismissed, setDismissed] = useState(false)

  const summary = describeQuarantine(record)

  /** Downloads the preserved payload so it can be inspected or re-imported. */
  const download = useCallback(() => {
    try {
      const blob = new Blob([record.raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'do-knowledge-studio-preserved-library.json'
      anchor.click()
      URL.revokeObjectURL(url)
      announce(t('announce.preservedLibraryDownloaded'))
      toast.success(t('announce.preservedLibrarySaved'))
    } catch (error) {
      console.error('Failed to download the preserved library:', error)
      toast.error(t('announce.preservedLibraryFailed'))
    }
  }, [announce, record.raw])

  const dismiss = useCallback(() => {
    // Dismissal clears the copy too: keeping a stale payload on disk invites a
    // false sense of security about a workspace the user chose to discard.
    clearQuarantine()
    setDismissed(true)
  }, [])

  if (dismissed) return null

  return (
    <section
      role="alert"
      aria-labelledby="quarantine-banner-title"
      data-testid="quarantine-banner"
      className={cn(
        'mb-6 rounded-lg border border-saffron/40 bg-saffron-soft/40 p-4',
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-saffron-deep" />
        <div>
          <h2
            id="quarantine-banner-title"
            className="font-serif text-[15px] font-semibold text-ink"
          >
            {t('announce.quarantineTitle')}
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {t('announce.quarantineBody', summary)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-faint">{record.reason}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={download}
          className={cn(
            'flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5',
            'text-label font-medium text-saffron-deep transition-colors',
            'hover:bg-saffron-soft focus-ring',
          )}
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          {t('announce.quarantineDownload')}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('announce.quarantineDismiss')}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md',
            'text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring',
          )}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
