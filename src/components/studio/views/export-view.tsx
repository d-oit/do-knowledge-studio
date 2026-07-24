'use client'

import {
  FileLock,
  FileText,
  Upload,
  Download,
  Shield,
  Sparkles,
  Check,
  ArrowRight,
  RotateCcw,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import {
  FORMATS,
  COLOR_MAP,
  todayStamp,
  downloadFile,
  downloadBlob,
  buildJsonExport,
  buildMarkdownExport,
  buildHtmlExport,
  buildPdfExport,
  buildDocxExport,
  parseImportFile,
  type ImportPreview,
} from './export-helpers'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'

export function ExportView() {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const importWithRollback = useStudioStore((s) => s.importWithRollback)
  const resetStore = useStudioStore((s) => s.resetStore)
  const setView = useStudioStore((s) => s.setView)
  const reducedMotion = useReducedMotion()

  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const resetCancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showResetConfirm && !importPreview) return
    resetCancelRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowResetConfirm(false)
        setImportPreview(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [showResetConfirm, importPreview])

  const handleExport = async (format: string) => {
    if (format === 'json') {
      const content = buildJsonExport(entities, claims)
      downloadFile(`do-knowledge-studio-export-${todayStamp()}.json`, content, 'application/json')
      toast.success('JSON export downloaded', {
        description: `${entities.length} entities · ${claims.length} claims`,
      })
      return
    }

    if (format === 'markdown') {
      const content = buildMarkdownExport(entities, claims)
      downloadFile(`do-knowledge-studio-${todayStamp()}.md`, content, 'text/markdown')
      toast.success('Markdown export downloaded', {
        description: `${entities.length} entities concatenated into one .md file`,
      })
      return
    }

    if (format === 'html') {
      const content = buildHtmlExport(entities, claims)
      downloadFile(`do-knowledge-studio-${todayStamp()}.html`, content, 'text/html')
      toast.success('HTML export downloaded', {
        description: 'Self-contained .html page — open in any browser.',
      })
      return
    }

    if (format === 'pdf') {
      try {
        const blob = buildPdfExport(entities, claims)
        downloadBlob(`do-knowledge-studio-${todayStamp()}.pdf`, blob)
        toast.success('PDF export downloaded', {
          description: `${entities.length} entities formatted in a print-ready PDF.`,
        })
      } catch (err) {
        toast.error('PDF export failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
      return
    }

    if (format === 'docx') {
      try {
        const blob = await buildDocxExport(entities, claims)
        downloadBlob(`do-knowledge-studio-${todayStamp()}.docx`, blob)
        toast.success('DOCX export downloaded', {
          description: `${entities.length} entities in a Word document.`,
        })
      } catch (err) {
        toast.error('DOCX export failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
      return
    }

    if (format === 'encrypted') {
      if (!password || password !== confirm) {
        toast.error('Password fields must match and not be empty.')
        return
      }
      const json = buildJsonExport(entities, claims)
      const encrypted = await encryptData(json, password)
      const html = buildEncryptedReaderHtml(encrypted)
      downloadFile(`do-knowledge-studio-encrypted-${todayStamp()}.html`, html, 'text/html')
      toast.success('Encrypted export downloaded', {
        description: 'AES-256-GCM encrypted with PBKDF2 key derivation.',
      })
      setShowPassword(false)
      setPassword('')
      setConfirm('')
      return
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const result = parseImportFile(text)
      if (!result.success) {
        const errorMessages = result.errors.map((err) => `${err.path}: ${err.message}`).join('; ')
        toast.error('Import failed', {
          description: errorMessages,
        })
        return
      }
      const { entities: ents, claims: cls } = result
      const existingIds = new Set(entities.map((ent) => ent.id))
      const duplicateIds = ents.filter((ent) => existingIds.has(ent.id)).map((ent) => ent.id)
      setImportPreview({
        entities: ents,
        claims: cls,
        entityCount: ents.length,
        claimCount: cls.length,
        version: 1,
        duplicateIds,
      })
    }
    reader.onerror = () => {
      toast.error('Import failed', { description: 'Could not read the file.' })
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = () => {
    if (!importPreview) return
    const result = importWithRollback(importPreview.entities, importPreview.claims)
    if (result.success) {
      toast.success('Import complete', {
        description: `${importPreview.entityCount} entities · ${importPreview.claimCount} claims replaced the current library.`,
      })
    } else {
      toast.error('Import failed — state restored', {
        description: result.error,
      })
    }
    setImportPreview(null)
  }

  const handleReset = () => {
    resetStore()
    toast.success('Restored to demo data', {
      description: 'All entities and claims have been reset to the seed dataset.',
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10 lg:py-8">
      <motion.section
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : undefined}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Export knowledge</h2>
          <p className="mt-1 text-[13px] text-ink-mute">
            Your data is local. Export it whenever you want — for backup, sharing, or migration.
          </p>
        </div>

        {entities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Download className="mx-auto mb-3 h-8 w-8 text-ink-faint/40" />
            <p className="text-[13px] text-ink-mute">No entities to export yet. Create some content first.</p>
            <button
              onClick={() => setView('editor')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              <FileText className="h-3.5 w-3.5" />
              Create entity
            </button>
          </div>
        ) : (
        <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f, i) => {
            const Icon = f.icon
            const isAvailable = f.available !== false
            const badgeStyle = f.badge === 'Secure'
              ? 'bg-emerald-100 px-2 py-0 text-badge font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-muted px-2 py-0 text-badge font-semibold uppercase tracking-wide text-ink-mute'
            return (
              <button
                key={f.id}
                style={{ '--i': i } as React.CSSProperties}
                disabled={!isAvailable}
                aria-disabled={!isAvailable}
                onClick={() => {
                  if (!isAvailable) return
                  if (f.id === 'encrypted') setShowPassword(true)
                  else void handleExport(f.id)
                }}
                className={cn(
                  'group flex flex-col rounded-lg border bg-card p-4 text-left transition-all focus-ring',
                  isAvailable
                    ? 'border-border hover:border-saffron/30 hover:shadow-md hover-lift'
                    : 'cursor-not-allowed border-dashed border-border/60 opacity-60',
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md',
                      COLOR_MAP[f.color],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {f.badge && (
                    <span className={cn('flex items-center gap-1 rounded-full', badgeStyle)}>
                      {f.badge === 'Secure' && <Shield className="h-2.5 w-2.5" />}
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className={cn(
                  'mb-1 font-serif text-[15px] font-semibold',
                  isAvailable ? 'text-ink group-hover:text-saffron-deep' : 'text-ink-mute',
                )}>
                  {f.name}
                </h3>
                <p className="flex-1 text-[12px] leading-relaxed text-ink-mute">
                  {f.description}
                </p>
                {isAvailable ? (
                  <div className="mt-3 flex items-center gap-1 text-label font-medium text-saffron-deep opacity-0 transition-opacity group-hover:opacity-100">
                    <Download className="h-3 w-3" />
                    Export now
                    <ArrowRight className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-1 text-label font-medium text-ink-faint">
                    Not yet available
                  </div>
                )}
              </button>
            )
          })}
        </div>
        )}
      </motion.section>

      <motion.section
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { delay: 0.1 }}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Import knowledge</h2>
          <p className="mt-1 text-[13px] text-ink-mute">
            Replace your current library with the contents of a JSON export. This action cannot be undone.
          </p>
        </div>

        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50 py-10 text-center transition-colors hover:border-saffron/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft">
            <Upload className="h-5 w-5 text-saffron" />
          </div>
          <h3 className="font-serif text-[15px] font-semibold text-ink">Choose a JSON file</h3>
          <p className="mt-1 text-[12px] text-ink-mute">
            Accepts exports from this view ({'{ entities: [], claims: [] }'})
          </p>
          <button
            onClick={handleImportClick}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            Choose file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </motion.section>

      <section className="rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/30 p-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-saffron" />
          <span className="text-label font-semibold uppercase tracking-wide text-saffron-deep">
            Backup tips
          </span>
        </div>
        <ul className="space-y-1 text-[12px] leading-relaxed text-ink-soft">
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            JSON exports are the most complete — they preserve all entities, claims, links, and tags.
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            PDF and DOCX are print-ready — great for sharing or archival.
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            Encrypted HTML is safe to email — the recipient needs the password to read it. (AES-256-GCM encrypted.)
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            Your library is automatically saved to this browser. Export a JSON backup weekly to be safe.
          </li>
        </ul>
      </section>

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

      {showPassword && (
        <div
          className="fixed inset-0 z-[800] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          onClick={() => { setShowPassword(false) }}
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] max-w-[92vw] rounded-xl border border-border bg-popover p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300">
                <FileLock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif text-[15px] font-semibold text-ink">Encrypt export</h3>
                <p className="text-label text-ink-faint">
                  AES-256-GCM encryption with PBKDF2 key derivation.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value) }}
                    placeholder="Choose a strong password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  />
                  <button
                    onClick={() => { setShowPass(!showPass) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-caption font-medium text-ink-faint hover:text-ink"
                  >
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
                  Confirm password
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value) }}
                  placeholder="Re-enter password"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                />
              </div>
              {password && confirm && password !== confirm && (
                <p className="text-label text-red-500">Passwords do not match.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setShowPassword(false) }}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExport('encrypted')}
                disabled={!password || password !== confirm}
                className="rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 press-scale focus-ring"
              >
                Encrypt &amp; export
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm reset"
          className="fixed inset-0 z-[800] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          onClick={() => { setShowResetConfirm(false) }}
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={(e) => e.stopPropagation()}
            className="w-[380px] max-w-[92vw] rounded-xl border border-border bg-popover p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif text-[15px] font-semibold text-ink">Reset to demo data?</h3>
                <p className="text-[12px] text-ink-mute">This will delete all your entities and claims.</p>
              </div>
            </div>
            <p className="mb-4 text-[13px] text-ink-soft">
              This action cannot be undone. Export your data first if you want to keep it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={resetCancelRef}
                onClick={() => { setShowResetConfirm(false) }}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleReset()
                  setShowResetConfirm(false)
                }}
                className="rounded-md bg-red-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-red-700 focus-ring"
              >
                Reset everything
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Import preview dialog */}
      {importPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm import"
          className="fixed inset-0 z-[800] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          onClick={() => { setImportPreview(null) }}
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
        </div>
      )}
    </div>
  )
}
