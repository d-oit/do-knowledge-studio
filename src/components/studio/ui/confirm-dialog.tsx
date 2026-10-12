'use client'

import { memo, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { Overlay } from './overlay'

/** Panel width for every confirmation dialog (kept in one place). */
const PANEL_WIDTH_CLASS = 'w-[380px] max-w-[92vw]' as const

/** Cancel is the safe default, so it takes initial focus in every dialog. */
const CANCEL_BUTTON_CLASS =
  'rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring min-h-touch'
const CONFIRM_BUTTON_CLASS =
  'rounded-md bg-red-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-red-700 focus-ring min-h-touch'

interface ConfirmDialogProps {
  open: boolean
  /** Accessible name of the modal dialog (usually the title). */
  ariaLabel: string
  title: string
  /** Optional one-line context rendered beside the icon. */
  subtitle?: string
  /** Explanation of what the destructive action will do. */
  body: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  /** Optional leading icon, rendered in the destructive treatment. */
  icon?: LucideIcon
}

/**
 * Shared confirmation dialog for destructive actions (#863).
 *
 * Every destructive action in the app funnels through this component: the
 * cancel button receives initial focus, Escape/backdrop dismiss, focus is
 * trapped by `Overlay`, and the confirm action is always the destructive
 * treatment. Callers own the `open` state and the strings (from the nearest
 * `src/lib/i18n/messages/` scope).
 */
export const ConfirmDialog = memo(function ConfirmDialog({
  open,
  ariaLabel,
  title,
  subtitle,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  icon: Icon,
}: ConfirmDialogProps) {
  const reducedMotion = useReducedMotion()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  if (!open) return null

  return (
    <Overlay open={open} onClose={onCancel} aria-label={ariaLabel} initialFocusRef={cancelRef}>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : undefined}
        className={`${PANEL_WIDTH_CLASS} rounded-xl border border-border bg-popover p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div>
            <h3 className="font-serif text-[15px] font-semibold text-ink">{title}</h3>
            {subtitle && <p className="text-[12px] text-ink-mute">{subtitle}</p>}
          </div>
        </div>
        <p className="mb-4 text-[13px] text-ink-soft">{body}</p>
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className={CANCEL_BUTTON_CLASS}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={CONFIRM_BUTTON_CLASS}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </Overlay>
  )
})
