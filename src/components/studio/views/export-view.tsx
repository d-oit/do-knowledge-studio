'use client'

import {
  FileText,
  FileJson,
  FileCode,
  FileArchive,
  FileLock,
  Upload,
  Download,
  Shield,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface ExportFormat {
  id: string
  name: string
  description: string
  icon: typeof FileText
  color: string
  badge?: string
}

const FORMATS: ExportFormat[] = [
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Plain-text .md files — one per entity. Portable, version-control friendly.',
    icon: FileText,
    color: 'saffron',
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'Single .json file with all entities, claims, and links. Best for backup.',
    icon: FileJson,
    color: 'sky',
  },
  {
    id: 'html',
    name: 'Static HTML site',
    description: 'Self-contained folder of HTML pages. Host anywhere or open locally.',
    icon: FileCode,
    color: 'sage',
  },
  {
    id: 'pdf',
    name: 'PDF document',
    description: 'Printable summary of all entities. Good for sharing a snapshot.',
    icon: FileArchive,
    color: 'clay',
  },
  {
    id: 'docx',
    name: 'DOCX document',
    description: 'Word document with headings, lists, and tables. Edit in Word or Google Docs.',
    icon: FileText,
    color: 'saffron',
  },
  {
    id: 'encrypted',
    name: 'Encrypted HTML',
    description: 'Self-contained reader protected by a password. Safe to share privately.',
    icon: FileLock,
    color: 'clay',
    badge: 'Secure',
  },
]

const COLOR_MAP: Record<string, string> = {
  saffron: 'bg-saffron-soft text-saffron-deep',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  sage: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  clay: 'bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300',
}

export function ExportView() {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleExport = (format: string) => {
    if (format === 'encrypted' && (!password || password !== confirm)) {
      toast.error('Password fields must match and not be empty.')
      return
    }
    toast.success(`Exported as ${format.toUpperCase()}`, {
      description: format === 'encrypted' ? 'Encrypted reader saved to your downloads.' : undefined,
    })
    if (format === 'encrypted') {
      setShowPassword(false)
      setPassword('')
      setConfirm('')
    }
  }

  const handleImport = () => {
    toast.success('Import started', { description: 'Choose a JSON or Markdown file to import.' })
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10 lg:py-8">
      {/* Export section */}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                onClick={() => (f.id === 'encrypted' ? setShowPassword(true) : handleExport(f.id))}
                className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-md focus-ring"
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
              </motion.button>
            )
          })}
        </div>
      </motion.section>

      {/* Import section */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold text-ink">Import knowledge</h2>
          <p className="mt-1 text-[13px] text-ink-mute">
            Bring in entities from another export, or from Markdown files.
          </p>
        </div>

        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50 py-10 text-center transition-colors hover:border-saffron/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft">
            <Upload className="h-5 w-5 text-saffron" />
          </div>
          <h3 className="font-serif text-[15px] font-semibold text-ink">Drop a file here</h3>
          <p className="mt-1 text-[12px] text-ink-mute">
            Supports .json (full export) and .md (one entity per file)
          </p>
          <button
            onClick={handleImport}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-ring"
          >
            Choose file
          </button>
        </div>
      </motion.section>

      {/* Tips */}
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
            Encrypted HTML is safe to email — the recipient needs the password to read it.
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            Schedule a weekly JSON export to a cloud folder for automatic backups.
          </li>
        </ul>
      </section>

      {/* Password modal */}
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
                <p className="text-[11px] text-ink-faint">Set a password for the encrypted reader.</p>
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
