'use client'

import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { ImportPreview } from './export-types'
import { useExportHandlers } from './use-export-handlers'
import { ExportFormatGrid } from './export-format-grid'
import { ImportDropzone } from './import-dropzone'
import { BackupTips } from './backup-tips'
import { RecoveryPanel } from './recovery-panel'
import { EncryptExportDialog } from './encrypt-export-dialog'
import {
  ConfirmDialog,
  VIEW_CONTAINER_CLASS,
} from '@/components/studio/ui/shared-primitives'
import { ImportPreviewDialog } from './import-preview-dialog'
import { translate } from '@/lib/i18n/messages/export'
import { cn } from '@/lib/utils'

/** Export and import view with format grid, dropzone, backup tips, and dialogs. */
export const ExportView = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const graph = useStudioStore((s) => s.graph)
  const mindMap = useStudioStore((s) => s.mindMap)
  const links = useStudioStore((s) => s.links)
  const tags = useStudioStore((s) => s.tags)
  const importWithRollback = useStudioStore((s) => s.importWithRollback)
  const resetStore = useStudioStore((s) => s.resetStore)
  const setView = useStudioStore((s) => s.setView)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const {
    handleExport,
    exportingFormat,
    handleImportClick,
    handleFileChange,
    handleConfirmImport,
    handleReset,
    showPassword,
    setShowPassword,
    password,
    setPassword,
    confirm,
    setConfirm,
    showPass,
    setShowPass,
  } = useExportHandlers({
    entities,
    claims,
    graph,
    mindMap,
    links,
    tags,
    importWithRollback,
    resetStore,
    importPreview,
    setImportPreview,
    fileInputRef,
  })


  return (
    <div className={cn(VIEW_CONTAINER_CLASS, 'max-w-5xl')}>
      <ExportFormatGrid
        entities={entities}
        setView={setView}
        setShowPassword={setShowPassword}
        handleExport={handleExport}
        exportingFormat={exportingFormat}
      />

      <ImportDropzone
        handleImportClick={handleImportClick}
        handleFileChange={handleFileChange}
        fileInputRef={fileInputRef}
      />

      <RecoveryPanel />

      <BackupTips />

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <p className="text-label text-ink-faint">
          {translate('export.view.counts', String(entities.length), String(claims.length))}
        </p>
        <button
          onClick={() => { setShowResetConfirm(true) }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 focus-ring"
          title={translate('export.view.resetTitle')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {translate('export.view.resetButton')}
        </button>
      </div>

      <EncryptExportDialog
        state={{ showPassword, password, confirm, showPass }}
        actions={{ setShowPassword, setPassword, setConfirm, setShowPass, handleExport }}
        exporting={exportingFormat === 'encrypted'}
      />

      <ConfirmDialog
        open={showResetConfirm}
        onConfirm={() => {
          handleReset()
          setShowResetConfirm(false)
        }}
        onCancel={() => { setShowResetConfirm(false) }}
        title={translate('export.reset.title')}
        body={translate('export.reset.body')}
        confirmLabel={translate('export.reset.confirm')}
        cancelLabel={translate('export.reset.cancel')}
        destructive
      />

      <ImportPreviewDialog
        state={{ preview: importPreview }}
        actions={{ close: setImportPreview, confirm: handleConfirmImport }}
      />
    </div>
  )
}
