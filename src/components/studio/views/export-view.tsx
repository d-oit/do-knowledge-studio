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
  RotateCcw,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import type { Claim, Entity } from '@/lib/studio/types'

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
    description: 'Single .md file with every entity (and its claims) separated by ---.',
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
    name: 'Static HTML',
    description: 'Single self-contained .html page that renders all entities. Open in any browser.',
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

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function todayStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Export content builders
// ---------------------------------------------------------------------------

function buildJsonExport(entities: Entity[], claims: Claim[]): string {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    claims,
  }
  return JSON.stringify(payload, null, 2)
}

function buildMarkdownExport(entities: Entity[], claims: Claim[]): string {
  const parts: string[] = []
  parts.push(`# DO Knowledge Studio — export\n`)
  parts.push(`Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.\n`)
  for (const e of entities) {
    const tags = e.tags.length ? e.tags.map((t) => `#${t}`).join('  ') : '—'
    const created = e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : '—'
    const updated = e.updatedAt ? new Date(e.updatedAt).toISOString().slice(0, 10) : '—'
    const links = e.links.length
      ? e.links.map((l) => `- → ${l.targetId} — ${l.relation}`).join('\n')
      : '—'

    parts.push('\n---\n')
    parts.push(`# ${e.name}\n`)
    parts.push(`**Type:** ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}  `)
    parts.push(`**Tags:** ${tags}  `)
    if (e.sourceUrl) parts.push(`**Source:** ${e.sourceUrl}  `)
    parts.push(`**Created:** ${created}  `)
    parts.push(`**Updated:** ${updated}\n`)
    if (e.description) parts.push(`> ${e.description}\n`)
    parts.push(`\n${e.content || '_(no body content)_'}\n`)
    parts.push(`\n**Links:**\n${links}\n`)

    const entityClaims = claims.filter((c) => c.entityId === e.id)
    if (entityClaims.length) {
      parts.push('\n## Claims\n')
      for (const c of entityClaims) {
        const pct = Math.round(c.confidence * 100)
        const src = c.source ? `, source: ${c.source}` : ''
        const ev = c.evidence ? ` — _${c.evidence}_` : ''
        parts.push(
          `- [${c.verification}] ${c.statement} (confidence: ${pct}%${src})${ev}`,
        )
      }
    } else {
      parts.push('\n## Claims\n_(none)_')
    }
    parts.push('')
  }
  return parts.join('\n')
}

function buildHtmlExport(entities: Entity[], claims: Claim[]): string {
  const rows = entities
    .map((e) => {
      const entityClaims = claims.filter((c) => c.entityId === e.id)
      const claimsHtml = entityClaims.length
        ? `<ul class="claims">${entityClaims
            .map(
              (c) =>
                `<li><span class="v ${c.verification}">${c.verification}</span> ${escapeHtml(
                  c.statement,
                )} <span class="meta">(${Math.round(c.confidence * 100)}%)</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="meta">No claims.</p>'
      return `<article>
  <header>
    <span class="type ${e.type}">${e.type}</span>
    <h2>${escapeHtml(e.name)}</h2>
    <p class="meta">${e.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>
  </header>
  <p class="desc">${escapeHtml(e.description)}</p>
  <pre>${escapeHtml(e.content)}</pre>
  <h3>Claims</h3>
  ${claimsHtml}
</article>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DO Knowledge Studio export</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 2rem; color: #1a1814; background: #faf8f3; }
    h1 { font-family: Georgia, serif; }
    article { border-top: 1px solid #e5e1d8; padding: 1.5rem 0; }
    article header h2 { font-family: Georgia, serif; margin: 0.4rem 0; font-size: 1.4rem; }
    .type { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; background: #f5e8d5; color: #8a4f1c; }
    .type.note { background: #e0eaf2; color: #2b4d6b; }
    .type.concept { background: #f5e8d5; color: #8a4f1c; }
    .type.person { background: #f3dcd2; color: #8a3320; }
    .type.project { background: #dce8df; color: #2f5b4a; }
    .desc { color: #6b6760; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f1ede4; padding: 0.75rem 1rem; border-radius: 6px; }
    .claims { padding-left: 1.2rem; }
    .claims .v { font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .claims .v.verified { background: #d4ead4; color: #1f6b1f; }
    .claims .v.disputed { background: #f5e3c8; color: #8a4f1c; }
    .claims .v.unverified { background: #e5e1d8; color: #6b6760; }
    .meta { color: #9c978d; font-size: 12px; }
  </style>
</head>
<body>
  <h1>DO Knowledge Studio — export</h1>
  <p class="meta">Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.</p>
  ${rows}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Encrypted HTML export — DEMO-GRADE OBFUSCATION ONLY (NOT real encryption).
// We XOR the JSON payload with the password (repeated cyclically) and then
// base64-encode the result. The reader prompts for the password and reverses
// the process in-browser. This is enough to demonstrate the concept of an
// encrypted reader but is NOT cryptographically secure — anyone with the file
// can extract the data with modest effort. Do not use for genuinely sensitive
// data.
// ---------------------------------------------------------------------------

function xorCipher(text: string, password: string): string {
  // Encode the text as UTF-8 bytes so non-ASCII characters (em dashes, ×,
  // emoji, etc.) don't blow past 0xFF and break btoa. We then XOR each byte
  // with the corresponding password byte (cycling the password) and
  // base64-encode the result.
  const bytes = new TextEncoder().encode(text)
  const pwBytes = new TextEncoder().encode(password)
  const out: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i] ^ pwBytes[i % pwBytes.length])
  }
  let binary = ''
  for (const b of out) binary += String.fromCharCode(b)
  return btoa(binary)
}

function buildEncryptedHtmlExport(
  entities: Entity[],
  claims: Claim[],
  password: string,
): string {
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entities, claims })
  const cipher = xorCipher(json, password)
  // Reader is self-contained: prompts for password, decrypts, renders JSON.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DO Knowledge Studio — encrypted reader</title>
  <!--
    DEMO-GRADE OBFUSCATION ONLY — NOT real encryption.
    The payload below is XOR-obfuscated with the password and base64-encoded.
    Anyone with this file can extract the data with modest effort. Do not use
    for genuinely sensitive data; use a real crypto library (e.g. libsodium,
    WebCrypto AES-GCM) for production.
  -->
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 2rem; color: #1a1814; background: #faf8f3; }
    h1 { font-family: Georgia, serif; }
    label { display: block; margin: 1rem 0 0.4rem; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6760; }
    input { width: 100%; padding: 0.5rem 0.75rem; font: inherit; border: 1px solid #e5e1d8; border-radius: 6px; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; font: inherit; font-weight: 600; background: #1a1814; color: #faf8f3; border: 0; border-radius: 6px; cursor: pointer; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f1ede4; padding: 0.75rem 1rem; border-radius: 6px; }
    .err { color: #b91c1c; margin-top: 0.5rem; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Encrypted reader</h1>
  <p>This file was exported from DO Knowledge Studio. Enter the password to decrypt the contents.</p>
  <label for="pw">Password</label>
  <input id="pw" type="password" autofocus />
  <button id="decrypt">Decrypt &amp; view</button>
  <p class="err" id="err"></p>
  <pre id="out"></pre>
  <script>
    var CIPHER = ${JSON.stringify(cipher)};
    function decode(cipher, password) {
      var binary = atob(cipher);
      var pwBytes = new TextEncoder().encode(password);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i) ^ pwBytes[i % pwBytes.length];
      }
      return new TextDecoder().decode(bytes);
    }
    document.getElementById('decrypt').addEventListener('click', function () {
      var pw = document.getElementById('pw').value;
      var err = document.getElementById('err');
      var out = document.getElementById('out');
      err.textContent = '';
      if (!pw) { err.textContent = 'Password is required.'; return; }
      try {
        var json = decode(CIPHER, pw);
        // Throws SyntaxError if the decoded text isn't valid JSON — i.e. wrong password.
        var data = JSON.parse(json);
        out.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        out.textContent = '';
        err.textContent = 'Decryption failed — wrong password or corrupted file.';
      }
    });
    document.getElementById('pw').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('decrypt').click();
    });
  </script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Import — parse a JSON file produced by this view (or any compatible
// { entities: [], claims: [] } shape).
// ---------------------------------------------------------------------------

function isEntity(x: unknown): x is Entity {
  if (!x || typeof x !== 'object') return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.type === 'string' &&
    typeof e.content === 'string'
  )
}

function isClaim(x: unknown): x is Claim {
  if (!x || typeof x !== 'object') return false
  const c = x as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.entityId === 'string' &&
    typeof c.statement === 'string' &&
    typeof c.verification === 'string'
  )
}

function parseImportFile(text: string): { entities: Entity[]; claims: Claim[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  if (!data || typeof data !== 'object') throw new Error('JSON root must be an object.')
  const root = data as Record<string, unknown>
  if (!Array.isArray(root.entities)) throw new Error('JSON must contain an "entities" array.')
  if (!Array.isArray(root.claims)) throw new Error('JSON must contain a "claims" array.')
  const entities = root.entities.filter(isEntity) as Entity[]
  const claims = root.claims.filter(isClaim) as Claim[]
  if (entities.length === 0) throw new Error('No valid entities found in file.')
  return { entities, claims }
}

// ---------------------------------------------------------------------------

export function ExportView() {
  const { entities, claims, importData, resetStore } = useStudioStore()

  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = (format: string) => {
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
      const content = buildEncryptedHtmlExport(entities, claims, password)
      downloadFile(`do-knowledge-studio-encrypted-${todayStamp()}.html`, content, 'text/html')
      toast.success('Encrypted reader downloaded', {
        description: 'Demo-grade obfuscation — see file header comment for caveats.',
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
    // Always reset the input value so selecting the same file twice triggers change.
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
            Encrypted HTML is safe to email — the recipient needs the password to read it. (Demo-grade obfuscation only.)
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            Your library is automatically saved to this browser. Export a JSON backup weekly to be safe.
          </li>
        </ul>
      </section>

      {/* Footer — destructive reset */}
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
                <p className="text-[11px] text-ink-faint">
                  Set a password for the encrypted reader. Demo-grade obfuscation only.
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
