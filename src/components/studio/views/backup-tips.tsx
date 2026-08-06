'use client'

import { memo } from 'react'
import { Sparkles, Check } from 'lucide-react'

/** Tip card listing best practices for backing up the local knowledge base. */
export const BackupTips = memo(function BackupTips() {
  return (
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
  )
})
