'use client'

import { memo } from 'react'
import { RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { translate } from '@/lib/i18n/messages/export'

interface ResetConfirmDialogProps {
  showResetConfirm: boolean
  setShowResetConfirm: (show: boolean) => void
  handleReset: () => void
  resetCancelRef: React.RefObject<HTMLButtonElement | null>
}

/** Confirmation dialog warning the user before resetting all data to demo state. */
export const ResetConfirmDialog = memo(function ResetConfirmDialog({
  showResetConfirm,
  setShowResetConfirm,
  handleReset,
  resetCancelRef,
}: ResetConfirmDialogProps) {
  const reducedMotion = useReducedMotion()

  if (!showResetConfirm) return null

  return (
    <Overlay
      open={showResetConfirm}
      onClose={() => { setShowResetConfirm(false) }}
      aria-label={translate('export.reset.ariaLabel')}
      initialFocusRef={resetCancelRef}
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
            <h3 className="font-serif text-[15px] font-semibold text-ink">{translate('export.reset.title')}</h3>
            <p className="text-[12px] text-ink-mute">{translate('export.reset.subtitle')}</p>
          </div>
        </div>
        <p className="mb-4 text-[13px] text-ink-soft">
          {translate('export.reset.body')}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={resetCancelRef}
            onClick={() => { setShowResetConfirm(false) }}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            {translate('export.reset.cancel')}
          </button>
          <button
            onClick={() => {
              handleReset()
              setShowResetConfirm(false)
            }}
            className="rounded-md bg-red-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-red-700 focus-ring"
          >
            {translate('export.reset.confirm')}
          </button>
        </div>
      </motion.div>
    </Overlay>
  )
})
