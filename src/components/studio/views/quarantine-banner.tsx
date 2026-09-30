'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as t } from '@/lib/i18n/messages/announce'
import { describeQuarantine, type QuarantineRecord } from '@/lib/studio/hydration-quarantine'
import { cn } from '@/lib/utils'

/** Filename offered for the raw persistence envelope. */
const RAW_BACKUP_FILENAME = 'do-knowledge-studio-preserved-library.json'

/**
 * Banner for a persistence envelope the store refused to hydrate.
 *
 * This is the user-visible half of the recovery path (ADR 028). The store
 * preserves refused bytes and blocks writes so they survive, but bytes sitting
 * in localStorage are not a recovery flow — the user has to be told and given
 * a way out.
 *
 * Two states, because they need different honesty:
 *
 * - `preserved`: a copy of the exact bytes exists. The user can download it.
 *   Hiding the warning is safe because the data does not depend on the banner.
 * - `unpreserved`: no copy exists, so the app is not saving and the session's
 *   edits are lost on reload. There is no hide control, because hiding that
 *   would hide the fact that the user's work is not being kept. The original
 *   bytes are still downloadable when they could be read.
 *
 * The download is the RAW persistence envelope, not the JSON export schema
 * (`buildJsonExport` writes a flat `{ version, exportedAt, entities }`, while
 * the envelope nests under `state`), so `parseImportFile` would reject it. The
 * copy text must not promise a re-import.
 */
export type QuarantineBannerProps =
  | { kind: 'preserved'; record: QuarantineRecord }
  | { kind: 'unpreserved'; reason: string; raw: string | null }

/**
 * Downloads `raw` verbatim as a forensic backup.
 *
 * Reports only that a download was started: the anchor click is not proof the
 * browser wrote the file, so no "saved" claim is made. A failure to even start
 * the download is reported as one.
 */
const useRawBackup = (raw: string) => {
  const announce = useAnnouncer()
  return useCallback(() => {
    try {
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = RAW_BACKUP_FILENAME
      anchor.click()
      URL.revokeObjectURL(url)
      announce(t('announce.preservedLibraryDownloaded'))
    } catch (error) {
      console.error('Failed to download the preserved library:', error)
      toast.error(t('announce.preservedLibraryFailed'))
    }
  }, [announce, raw])
}

/** Shared action styling: 44px floor and a visible keyboard focus ring. */
const ACTION_CLASS = cn(
  'flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5',
  'text-label font-medium text-saffron-deep transition-colors',
  'hover:bg-saffron-soft focus-ring',
)

/** The download button, omitted entirely when there are no readable bytes. */
const RawBackupButton = ({ raw }: { raw: string }) => {
  const download = useRawBackup(raw)
  return (
    <button type="button" onClick={download} className={ACTION_CLASS}>
      <Download aria-hidden="true" className="h-3.5 w-3.5" />
      {t('announce.quarantineDownload')}
    </button>
  )
}

/** Alert shell shared by both states. */
const AlertShell = ({
  id,
  testId,
  tone,
  title,
  children,
  actions,
}: {
  id: string
  testId: string
  tone: string
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) => (
  <section
    role="alert"
    aria-labelledby={`${id}-title`}
    data-testid={testId}
    className={cn(
      'mb-6 rounded-lg border p-4',
      'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      tone,
    )}
  >
    <div className="flex gap-3">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-saffron-deep" />
      <div>
        <h2 id={`${id}-title`} className="font-serif text-[15px] font-semibold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </section>
)

/**
 * Non-destructive session dismissal.
 *
 * This only hides the UI. It deliberately does NOT call `clearQuarantine`:
 * that utility deletes the only preserved copy of a user's library, and a
 * single click must never be able to destroy it. Reloading brings the warning
 * back, because the bytes are still there.
 */
const HideForSessionButton = ({ onHide }: { onHide: () => void }) => (
  <button
    type="button"
    onClick={onHide}
    aria-label={t('announce.quarantineDismiss')}
    className={cn(
      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md',
      'text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring',
    )}
  >
    <X aria-hidden="true" className="h-4 w-4" />
  </button>
)

/** Banner for a preserved copy that could not be loaded. */
const PreservedBanner = ({ record }: { record: QuarantineRecord }) => {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <AlertShell
      id="quarantine-banner"
      testId="quarantine-banner"
      tone="border-saffron/40 bg-saffron-soft/40"
      title={t('announce.quarantineTitle')}
      actions={<RawBackupButton raw={record.raw} />}
    >
      <p className="mt-1 text-[13px] text-ink-soft">
        {t('announce.quarantineBody', describeQuarantine(record))}
      </p>
      <p className="mt-1 font-mono text-[11px] text-ink-faint">{record.reason}</p>
      <div className="mt-2 flex justify-start">
        <HideForSessionButton onHide={() => setHidden(true)} />
      </div>
    </AlertShell>
  )
}

/** Urgent banner for a refusal with no preserved copy: nothing is being saved. */
const UnpreservedBanner = ({ reason, raw }: { reason: string; raw: string | null }) => (
  <AlertShell
    id="quarantine-unpreserved-banner"
    testId="quarantine-unpreserved-banner"
    tone="border-destructive/50 bg-destructive/10"
    title={t('announce.quarantineUnpreservedTitle')}
    actions={raw === null ? undefined : <RawBackupButton raw={raw} />}
  >
    <p className="mt-1 text-[13px] text-ink-soft">
      {raw === null
        ? t('announce.quarantineUnpreservedBodyUnreadable')
        : t('announce.quarantineUnpreservedBody')}
    </p>
    <p className="mt-1 font-mono text-[11px] text-ink-faint">{reason}</p>
  </AlertShell>
)

/** Renders the recovery alert appropriate to a hydration refusal. */
export const QuarantineBanner = (props: QuarantineBannerProps) =>
  props.kind === 'preserved' ? (
    <PreservedBanner record={props.record} />
  ) : (
    <UnpreservedBanner reason={props.reason} raw={props.raw} />
  )
