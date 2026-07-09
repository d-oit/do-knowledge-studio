'use client'

import {
  FileLock,
  Upload,
  Download,
  Shield,
  Sparkles,
  Check,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import {
  FORMATS,
  COLOR_MAP,
  todayStamp,
  downloadFile,
  buildJsonExport,
  buildMarkdownExport,
  buildHtmlExport,
  parseImportFile,
} from './export-helpers'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'

export function ExportView() {
  const { entities, claims, importData, resetStore } = useStudioStore()

  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
      toast.info('PDF export coming soon', {
        description: 'Will require a headless render library. Use the Markdown or HTML export for now.',
      })
      return
    }

    if (format === 'docx') {
      toast.info('DOCX export coming soon', {
        description: 'Will require a docx-generation library. Use the Markdown export for now.',
      })
      return
    }

    if (format === 'encrypted') {
      if (!password || password !== confirm) {
        toast.error('Password fields must match and not be empty.')
        return
      }
      const json = buildJsonExport(entities, claims)
      const encrypted = await encryptData(json, password)
      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- HTML is intentionally built for encrypted export download */
      const html = buildEncryptedReaderHtml(encrypted)
      downloadFile(`do-knowledge-studio-encrypted-${todayStamp()}.html`, html, 'text/html')
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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
      try {
        const { entities: ents, claims: cls } = parseImportFile(text)
        importData(ents, cls)
        toast.success('Import complete', {
          description: `${ents.length} entities · ${cls.length} claims replaced the current library.`,
        })
      } catch (err) {
        toast.error('Import failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
    reader.onerror = () => {
      toast.error('Import failed', { description: 'Could not read the file.' })
    }
    reader.readAsText(file)
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold text-ink">Export knowledge</h2>
          <p className="mt-1 text-[13px] text-ink-mute">
            Your data is local. Export it whenever you want — for backup, sharing, or migration.
          </p>
        </div>

        <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f, i) => {
            const Icon = f.icon
            return (
              <button
                key={f.id}
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => (f.id === 'encrypted' ? setShowPassword(true) : handleExport(f.id))}
                className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-md hover-lift focus-ring"
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
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <Shield className="h-2.5 w-2.5" />
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="mb-1 font-serif text-[15px] font-semibold text-ink group-hover:text-saffron-deep">
                  {f.name}
                </h3>
                <p className="flex-1 text-[12px] leading-relaxed text-ink-mute">
                  {f.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-saffron-deep opacity-0 transition-opacity group-hover:opacity-100">
                  <Download className="h-3 w-3" />
                  Export now
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            )
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold text-ink">Import knowledge</h2>
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
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-ring"
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-saffron-deep">
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
            Encrypted HTML is safe to email — the recipient needs the password to read it. (AES-256-GCM encrypted.)
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            Your library is automatically saved to this browser. Export a JSON backup weekly to be safe.
          </li>
        </ul>
      </section>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <p className="text-[11px] text-ink-faint">
          {entities.length} entities · {claims.length} claims · saved to this browser
        </p>
        <button
          onClick={handleReset}
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
          onClick={() => setShowPassword(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] max-w-[92vw] rounded-xl border border-border bg-popover p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300">
                <FileLock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif text-[15px] font-semibold text-ink">Encrypt export</h3>
                <p className="text-[11px] text-ink-faint">
                  AES-256-GCM encryption with PBKDF2 key derivation.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-ink-faint hover:text-ink"
                  >
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Confirm password
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                />
              </div>
              {password && confirm && password !== confirm && (
                <p className="text-[11px] text-red-500">Passwords do not match.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPassword(false)}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExport('encrypted')}
                disabled={!password || password !== confirm}
                className="rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 focus-ring"
              >
                Encrypt &amp; export
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
