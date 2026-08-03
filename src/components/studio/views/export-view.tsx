'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { ImportPreview } from './export-helpers'
import { useExportHandlers } from './use-export-handlers'
import { ExportFormatGrid } from './export-format-grid'
import { ImportDropzone } from './import-dropzone'
import { BackupTips } from './backup-tips'
import { EncryptExportDialog } from './encrypt-export-dialog'
import { ResetConfirmDialog } from './reset-confirm-dialog'
import { ImportPreviewDialog } from './import-preview-dialog'

export function ExportView() {
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
  const resetCancelRef = useRef<HTMLButtonElement>(null)

  const {
    handleExport,
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

  useEffect(() => {
    if (!showResetConfirm) return
    resetCancelRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowResetConfirm(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [showResetConfirm])

  useEffect(() => {
    if (!importPreview) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImportPreview(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [importPreview])

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10 lg:py-8">
      <ExportFormatGrid
        entities={entities}
        setView={setView}
        setShowPassword={setShowPassword}
        handleExport={handleExport}
      />

      <ImportDropzone
        handleImportClick={handleImportClick}
        handleFileChange={handleFileChange}
        fileInputRef={fileInputRef}
      />

      <BackupTips />

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <p className="text-label text-ink-faint">
          {entities.length} entities · {claims.length} claims · saved to this browser
        </p>
        <button
          onClick={() => { setShowResetConfirm(true) }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 focus-ring"
          title="Clear the local store and restore the seed entities"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to demo data
        </button>
      </div>

      <EncryptExportDialog
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        password={password}
        setPassword={setPassword}
        confirm={confirm}
        setConfirm={setConfirm}
        showPass={showPass}
        setShowPass={setShowPass}
        handleExport={handleExport}
      />

      <ResetConfirmDialog
        showResetConfirm={showResetConfirm}
        setShowResetConfirm={setShowResetConfirm}
        handleReset={handleReset}
        resetCancelRef={resetCancelRef}
      />

      <ImportPreviewDialog
        importPreview={importPreview}
        setImportPreview={setImportPreview}
        handleConfirmImport={handleConfirmImport}
      />
    </div>
  )
}
