'use client'

import { memo } from 'react'
import { FileLock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import type { ExportFormatId } from './export-types'
import { translate } from '@/lib/i18n/messages/export'

interface EncryptExportDialogProps {
  showPassword: boolean
  setShowPassword: (show: boolean) => void
  password: string
  setPassword: (password: string) => void
  confirm: string
  setConfirm: (confirm: string) => void
  showPass: boolean
  setShowPass: (show: boolean) => void
  handleExport: (format: ExportFormatId) => Promise<void>
}

/** Dialog for setting a password to AES-256-GCM encrypt the exported file. */
export const EncryptExportDialog = memo(function EncryptExportDialog({
  showPassword,
  setShowPassword,
  password,
  setPassword,
  confirm,
  setConfirm,
  showPass,
  setShowPass,
  handleExport,
}: EncryptExportDialogProps) {
  const reducedMotion = useReducedMotion()

  if (!showPassword) return null

  return (
    <Overlay
      open={showPassword}
      onClose={() => { setShowPassword(false) }}
      aria-label={translate('export.encrypt.ariaLabel')}
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
            <h3 className="font-serif text-[15px] font-semibold text-ink">{translate('export.encrypt.title')}</h3>
            <p className="text-label text-ink-faint">
              {translate('export.encrypt.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="encrypt-password" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
              {translate('export.encrypt.passwordLabel')}
            </label>
            <div className="relative">
              <input
                id="encrypt-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value) }}
                placeholder={translate('export.encrypt.passwordPlaceholder')}
                aria-invalid={Boolean(password && confirm && password !== confirm)}
                aria-describedby={password && confirm && password !== confirm ? 'password-mismatch-error' : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              />
              <button
                onClick={() => { setShowPass(!showPass) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-caption font-medium text-ink-faint hover:text-ink focus-ring"
                aria-label={showPass ? translate('export.encrypt.hidePassword') : translate('export.encrypt.showPassword')}
              >
                {showPass ? translate('export.encrypt.hide') : translate('export.encrypt.show')}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="encrypt-confirm-password" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
              {translate('export.encrypt.confirmLabel')}
            </label>
            <input
              id="encrypt-confirm-password"
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value) }}
              placeholder={translate('export.encrypt.confirmPlaceholder')}
              aria-invalid={Boolean(password && confirm && password !== confirm)}
              aria-describedby={password && confirm && password !== confirm ? 'password-mismatch-error' : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
          </div>
          {password && confirm && password !== confirm && (
            <p id="password-mismatch-error" className="text-label text-red-500">{translate('export.encrypt.mismatch')}</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => { setShowPassword(false) }}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            {translate('export.encrypt.cancel')}
          </button>
          <button
            onClick={() => { handleExport('encrypted').catch(() => undefined) }}
            disabled={!password || password !== confirm}
            className="rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 press-scale focus-ring"
          >
            {translate('export.encrypt.submit')}
          </button>
        </div>
      </motion.div>
    </Overlay>
  )
})
