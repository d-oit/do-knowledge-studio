'use client'

import { useRef, useState } from 'react'
import { ShieldCheck, Upload, Download, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import packageJson from '../../../../package.json'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ValidatedGraph, ValidatedLink, ValidatedMindMap, ValidatedTag } from '@/lib/studio/schema'
import type { ImportOutcome } from '@/lib/studio/store-types'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { downloadBlob, todayStamp } from './export-types'
import { translate } from '@/lib/i18n/messages/backup'
import type { RestoreMode, RestoreOptions, RestorePreview } from '@/lib/backup/restore'

interface BackupPanelProps {
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
  importWithRollback: (entities: Entity[], claims: Claim[], options?: {
    graph?: ValidatedGraph
    mindMap?: ValidatedMindMap
    links?: ValidatedLink[]
    tags?: ValidatedTag[]
  }) => ImportOutcome
}

/** Download and restore the verifiable `.dksb` backup format. */
export const BackupPanel = ({
  entities,
  claims,
  graph,
  mindMap,
  links,
  tags,
  importWithRollback,
}: BackupPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [restorePassphrase, setRestorePassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [rawArchive, setRawArchive] = useState<string | null>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [mode, setMode] = useState<RestoreMode>('replace')
  const [duplicatePolicy, setDuplicatePolicy] = useState<RestoreOptions['duplicatePolicy']>('skip')

  const handleDownload = async () => {
    setBusy(true)
    try {
      const { buildBackupArchive } = await import('@/lib/backup/archive')
      const raw = await buildBackupArchive(
        { entities, claims, graph, mindMap, links, tags, appVersion: packageJson.version },
        passphrase.trim() || undefined,
      )
      downloadBlob(
        `do-knowledge-studio-backup-${todayStamp()}.dksb`,
        new Blob([raw], { type: 'application/json' }),
      )
      setPassphrase('')
      toast.success(translate('backup.downloaded'), {
        description: translate('backup.downloadedBody', '3'),
      })
    } catch (error) {
      toast.error(translate('backup.downloadFailed'), {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const verify = async (raw: string, secret: string) => {
    setVerifyBusy(true)
    setErrors([])
    try {
      const [{ verifyBackupArchive }, { buildRestorePreview }] = await Promise.all([
        import('@/lib/backup/archive'),
        import('@/lib/backup/restore'),
      ])
      const result = await verifyBackupArchive(raw, secret.trim() || undefined)
      if (!result.ok) {
        setErrors(result.errors)
        if (result.code !== 'passphrase-required') {
          toast.error(translate('backup.invalid'))
        }
        return
      }
      setPreview(buildRestorePreview(result.backup, { entities, claims, graph, mindMap, links, tags }))
      setRestorePassphrase('')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)])
      toast.error(translate('backup.invalid'))
    } finally {
      setVerifyBusy(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const raw = await file.text()
      setRawArchive(raw)
      await verify(raw, restorePassphrase)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)])
      toast.error(translate('backup.invalid'))
    }
  }

  const handleConfirm = async () => {
    if (preview === null) return
    const { composeRestore } = await import('@/lib/backup/restore')
    const composed = composeRestore(
      preview,
      { entities, claims, graph, mindMap, links, tags },
      { mode, duplicatePolicy },
    )
    const result = importWithRollback(composed.entities, composed.claims, {
      graph: composed.graph,
      mindMap: composed.mindMap,
      links: composed.links,
      tags: composed.tags,
    })
    if (!result.success) {
      toast.error(translate('backup.applyFailed'), { description: result.error })
      return
    }
    toast.success(translate('backup.applied'), {
      description: translate(
        'backup.appliedBody',
        String(composed.entities.length),
        String(composed.claims.length),
      ),
    })
    setPreview(null)
    setRawArchive(null)
    setRestorePassphrase('')
  }

  return (
    <section aria-labelledby="backup-panel-title" className="mb-8 rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-saffron-soft text-saffron-deep">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 id="backup-panel-title" className="font-serif text-body-lg font-semibold text-ink">
            {translate('backup.title')}
          </h2>
          <p className="text-label-lg text-ink-mute">{translate('backup.description')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="backup-passphrase" className="text-label font-semibold text-ink-soft">
            {translate('backup.passphrase')}
          </label>
          <input
            id="backup-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(event) => { setPassphrase(event.target.value) }}
            placeholder={translate('backup.passphrasePlaceholder')}
            aria-describedby="backup-passphrase-help"
            className="w-full min-h-touch rounded-md border border-border bg-background px-3 py-2 text-body-sm text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
          />
          <p id="backup-passphrase-help" className="text-caption text-ink-faint">
            {translate('backup.passphraseHelp')}
          </p>
          <button
            onClick={() => { void handleDownload() }}
            disabled={busy}
            className="flex min-h-touch items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {busy ? translate('backup.downloading') : translate('backup.download')}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-label font-semibold text-ink-soft">{translate('backup.restore')}</p>
          <p className="text-caption text-ink-faint">{translate('backup.restoreHint')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dksb,application/json"
            className="sr-only"
            aria-label={translate('backup.restore')}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void handleFile(file)
            }}
          />
          <button
            onClick={() => { fileInputRef.current?.click() }}
            disabled={verifyBusy}
            className="flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-label-lg font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring disabled:opacity-50"
          >
            {verifyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {verifyBusy ? translate('backup.verifying') : translate('backup.verify')}
          </button>
          {rawArchive !== null && (
            <div className="space-y-2">
              <label htmlFor="backup-restore-passphrase" className="text-label font-semibold text-ink-soft">
                {translate('backup.passphrase')}
              </label>
              <input
                id="backup-restore-passphrase"
                type="password"
                autoComplete="off"
                value={restorePassphrase}
                onChange={(event) => { setRestorePassphrase(event.target.value) }}
                className="w-full min-h-touch rounded-md border border-border bg-background px-3 py-2 text-body-sm text-ink focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              />
              <button
                onClick={() => { void verify(rawArchive, restorePassphrase) }}
                disabled={verifyBusy}
                className="min-h-touch rounded-md border border-border px-3 py-2 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring disabled:opacity-50"
              >
                {translate('backup.verify')}
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-label text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> {translate('backup.errors')}
              </div>
              <ul className="list-disc space-y-0.5 pl-4">
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Overlay
        open={preview !== null}
        onClose={() => { setPreview(null) }}
        aria-label={translate('backup.verifiedTitle')}
      >
        {preview !== null && (
          <div className="w-[460px] max-w-[92vw] rounded-xl border border-border bg-popover p-6 shadow-2xl">
            <h3 className="mb-1 font-serif text-body-lg font-semibold text-ink">
              {translate('backup.verifiedTitle')}
            </h3>
            <p className="mb-4 text-label-lg text-ink-mute">{translate('backup.verifiedBody')}</p>
            <dl className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3 text-label-lg">
              <dt className="text-ink-mute">{translate('backup.integrity')}</dt>
              <dd className="text-emerald-600">{translate('backup.integrityVerified')}</dd>
              <dt className="text-ink-mute">{translate('backup.exportedAt')}</dt>
              <dd className="text-ink">{preview.backup.manifest.exportedAt}</dd>
              <dt className="text-ink-mute">{translate('backup.appVersion')}</dt>
              <dd className="text-ink">{preview.backup.manifest.appVersion}</dd>
              <dt className="text-ink-mute">{translate('backup.records')}</dt>
              <dd className="text-ink">
                {translate('backup.counts', String(preview.entities.length), String(preview.claims.length))}
              </dd>
            </dl>
            {preview.warnings.length > 0 && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-label text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <div className="mb-1 font-semibold">{translate('backup.warnings')}</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
            <fieldset className="mb-3">
              <legend className="mb-1 text-label font-semibold text-ink-soft">{translate('backup.mode')}</legend>
              <label className="flex items-center gap-2 text-label-lg text-ink">
                <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => { setMode('replace') }} />
                {translate('backup.modeReplace')}
              </label>
              <label className="flex items-center gap-2 text-label-lg text-ink">
                <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => { setMode('merge') }} />
                {translate('backup.modeMerge')}
              </label>
            </fieldset>
            {mode === 'merge' && (
              <fieldset className="mb-4">
                <legend className="mb-1 text-label font-semibold text-ink-soft">{translate('backup.duplicatePolicy')}</legend>
                <label className="flex items-center gap-2 text-label-lg text-ink">
                  <input type="radio" name="duplicate-policy" checked={duplicatePolicy === 'skip'} onChange={() => { setDuplicatePolicy('skip') }} />
                  {translate('backup.duplicateSkip')}
                </label>
                <label className="flex items-center gap-2 text-label-lg text-ink">
                  <input type="radio" name="duplicate-policy" checked={duplicatePolicy === 'overwrite'} onChange={() => { setDuplicatePolicy('overwrite') }} />
                  {translate('backup.duplicateOverwrite')}
                </label>
              </fieldset>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setPreview(null) }}
                className="min-h-touch rounded-md border border-border px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
              >
                {translate('backup.cancel')}
              </button>
              <button
                onClick={() => { void handleConfirm() }}
                className="min-h-touch rounded-md bg-primary px-4 py-1.5 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
              >
                {mode === 'replace' ? translate('backup.confirmReplace') : translate('backup.confirmMerge')}
              </button>
            </div>
          </div>
        )}
      </Overlay>
    </section>
  )
}
