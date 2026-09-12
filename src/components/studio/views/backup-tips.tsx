'use client'

import { memo } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { translate } from '@/lib/i18n/messages/export'

/** Tip card listing best practices for backing up the local knowledge base. */
export const BackupTips = memo(function BackupTips() {
  return (
    <section className="rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/30 p-4">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-saffron" />
        <span className="text-label font-semibold uppercase tracking-wide text-saffron-deep">
          {translate('export.backupTips.title')}
        </span>
      </div>
      <ul className="space-y-1 text-[12px] leading-relaxed text-ink-soft">
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          {translate('export.backupTips.json')}
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          {translate('export.backupTips.pdfDocx')}
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          {translate('export.backupTips.encryptedHtml')}
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          {translate('export.backupTips.autoSave')}
        </li>
      </ul>
    </section>
  )
})
