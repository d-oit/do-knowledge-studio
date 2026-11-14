'use client'

import { useCallback, useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import { commitMergedState } from '@/lib/sync/bridge'
import {
  MAX_SYNC_BUNDLE_BYTES,
  buildSyncBundle,
  mergeSyncBundle,
  parseSyncBundle,
  syncBundleFileName,
  type SyncBundleErrorCode,
} from '@/lib/sync/file-bundle'
import type { FieldConflict } from '@/lib/sync/merge'
import { translate as t } from '@/lib/i18n/messages/sync'
import { downloadFile } from './export-types'

/** Maps a bundle parse failure to its localized message. */
const errorMessage = (code: SyncBundleErrorCode, detail?: string): string => {
  switch (code) {
    case 'too-large':
      return t('syncFile.error.tooLarge')
    case 'invalid-json':
      return t('syncFile.error.invalidJson')
    case 'unsupported-format':
      return t('syncFile.error.unsupportedFormat')
    case 'unsupported-version':
      return t('syncFile.error.unsupportedVersion')
    case 'password-required':
      return t('syncFile.error.passwordRequired')
    case 'decrypt-failed':
      return t('syncFile.error.decryptFailed')
    case 'invalid-records':
      return t('syncFile.error.invalidRecords', detail ?? '')
    default:
      return t('syncFile.error.invalidJson')
  }
}

const INPUT_CLASS =
  'min-h-11 rounded-md border border-border bg-background px-3 text-body-sm text-ink'
const BUTTON_CLASS =
  'flex min-h-11 items-center gap-1.5 rounded-md bg-saffron px-3 text-label-lg font-medium text-saffron-foreground hover:opacity-90 disabled:opacity-60'

/**
 * File-based sync fallback (#1133).
 *
 * Exports the local corpus as a portable bundle and merges an imported bundle
 * through the same conflict-aware merge the room join uses. Import never
 * replaces the library: records are matched by id and resolved by timestamp,
 * and any disagreement is handed to the existing conflict UI.
 */
export const SyncFilePanel = ({
  activeRoomId,
  onConflicts,
  onEvent,
}: {
  activeRoomId: string
  onConflicts: (conflicts: FieldConflict[]) => void
  onEvent: (type: 'sync' | 'error', message: string) => void
}) => {
  const entities = useStudioStore((state) => state.entities)
  const claims = useStudioStore((state) => state.claims)
  const [roomId, setRoomId] = useState(activeRoomId)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async (): Promise<void> => {
    const id = roomId.trim()
    if (id === '') {
      toast.error(t('syncFile.error.roomRequired'))
      return
    }
    setBusy('export')
    try {
      const text = await buildSyncBundle({ roomId: id, entities, claims, password })
      const name = syncBundleFileName(id)
      downloadFile(name, text, 'application/json')
      toast.success(t('syncFile.exported', name))
      onEvent('sync', t('syncFile.exported', name))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('sync.error.unknown')
      toast.error(message)
      onEvent('error', message)
    } finally {
      setBusy(null)
    }
  }, [roomId, entities, claims, password, onEvent])

  const handleImport = useCallback(
    async (file: File): Promise<void> => {
      if (file.size > MAX_SYNC_BUNDLE_BYTES) {
        toast.error(t('syncFile.error.tooLarge'))
        return
      }
      setBusy('import')
      try {
        const text = await file.text()
        const parsed = await parseSyncBundle(text, password)
        if (!parsed.ok) {
          const message = errorMessage(parsed.code, parsed.detail)
          toast.error(message)
          onEvent('error', message)
          return
        }
        const merged = mergeSyncBundle(parsed.bundle, entities, claims)
        if (!commitMergedState(merged.entities, merged.claims)) {
          toast.error(t('syncFile.error.commitFailed'))
          onEvent('error', t('syncFile.error.commitFailed'))
          return
        }
        onConflicts(merged.conflicts)
        const message =
          merged.conflicts.length > 0
            ? t('syncFile.importedWithConflicts', String(merged.conflicts.length))
            : t(
                'syncFile.imported',
                String(merged.entities.length),
                String(merged.claims.length),
              )
        toast.success(message)
        onEvent('sync', message)
      } catch (error) {
        const message = error instanceof Error ? error.message : t('syncFile.error.readFailed')
        toast.error(message)
        onEvent('error', message)
      } finally {
        setBusy(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [entities, claims, password, onConflicts, onEvent],
  )

  return (
    <section id="sync-file-panel" className="mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 font-serif text-body-lg font-semibold text-ink">{t('syncFile.title')}</h2>
      <p className="mb-3 text-caption text-ink-faint">{t('syncFile.description')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-label text-ink-soft">
          {t('syncFile.roomId')}
          <input
            className={INPUT_CLASS}
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value)
            }}
            placeholder={t('syncFile.roomIdPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-label text-ink-soft">
          {t('syncFile.password')}
          <input
            className={INPUT_CLASS}
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            autoComplete="new-password"
          />
        </label>
      </div>
      <p className="mt-2 text-caption text-ink-faint">{t('syncFile.passwordHint')}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={busy !== null}
          onClick={() => {
            void handleExport()
          }}
        >
          {busy === 'export' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {t('syncFile.export')}
        </button>

        <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-label-lg font-medium text-ink hover:bg-muted">
          {busy === 'import' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {t('syncFile.import')}
          <input
            ref={fileInputRef}
            type="file"
            accept=".dksb,application/json"
            className="sr-only"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
        </label>
      </div>
    </section>
  )
}
