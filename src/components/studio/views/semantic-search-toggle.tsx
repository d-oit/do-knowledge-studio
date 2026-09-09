'use client'

import { memo } from 'react'
import { Switch } from '@/components/ui/switch'
import { t } from '@/lib/i18n/messages/search'
import { cn } from '@/lib/utils'

interface SemanticSearchToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

/**
 * Toggle that switches the library search between lexical (BM25) and
 * semantic (multilingual embedding) ranking. The Radix switch renders a
 * native `role="switch"`; wrapping it in a label exposes the i18n label as
 * its accessible name, and the 44px hit target meets the touch-target rule.
 */
export const SemanticSearchToggle = memo(function SemanticSearchToggle({
  checked,
  onCheckedChange,
  className,
}: SemanticSearchToggleProps) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-within:ring-1 focus-within:ring-saffron/30',
        className,
      )}
      title={t('search.semanticToggleHint')}
    >
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={t('search.semanticToggleLabel')}
      />
      {t('search.semanticToggleLabel')}
    </label>
  )
})