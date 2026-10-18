'use client'

import { memo } from 'react'
import { FileText, Download, Shield, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { FORMATS, COLOR_MAP } from './export-types'
import type { ExportFormatId } from './export-types'
import type { Entity, ViewId } from '@/lib/studio/types'
import { translate } from '@/lib/i18n/messages/export'
import { ViewEmptyState, ViewHeader } from '../ui/shared-primitives'

interface ExportFormatGridProps {
  entities: Entity[]
  setView: (view: ViewId) => void
  setShowPassword: (show: boolean) => void
  handleExport: (format: ExportFormatId) => Promise<void>
  /** The format whose export is still running, or null when idle. */
  exportingFormat: ExportFormatId | null
}

/** Grid of export format options with empty state and format cards. */
export const ExportFormatGrid = memo(({
  entities,
  setView,
  setShowPassword,
  handleExport,
  exportingFormat,
}: ExportFormatGridProps) => {
  const reducedMotion = useReducedMotion()
  // `Boolean` (not `!== null`): an incomplete caller-supplied hook object can
  // omit the prop entirely, and a missing value must read as idle, not busy.
  const isExporting = Boolean(exportingFormat)
  /** Display name of the running format, for the busy status line. */
  const exportingName = exportingFormat
    ? FORMATS.find((f) => f.id === exportingFormat)?.name ?? exportingFormat
    : ''

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      aria-busy={isExporting}
      className="mb-8"
    >
      <ViewHeader
        icon={Download}
        title={translate('export.grid.title')}
        subtitle={translate('export.grid.subtitle')}
        className="mb-4"
      />

      {isExporting && (
        <p role="status" className="mb-4 flex items-center gap-2 text-label-lg font-medium text-ink-mute">
          <Loader2
            className={cn('h-3.5 w-3.5', !reducedMotion && 'animate-spin')}
            aria-hidden="true"
          />
          {translate('export.grid.exporting', exportingName)}
        </p>
      )}

      {entities.length === 0 ? (
        <ViewEmptyState
          icon={Download}
          title={translate('export.empty.title')}
          body={translate('export.empty.body')}
          actionLabel={translate('export.grid.createEntity')}
          actionIcon={FileText}
          onAction={() => { setView('editor') }}
        />
      ) : (
      <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATS.map((f, i) => {
          const Icon = f.icon
          const isAvailable = f.available !== false
          const badgeStyle = f.badge === 'Secure'
            ? 'bg-emerald-100 px-2 py-0 text-badge font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-muted px-2 py-0 text-badge font-semibold uppercase tracking-wide text-ink-mute'
          return (
            <button
              key={f.id}
              style={{ '--i': i } as React.CSSProperties}
              disabled={!isAvailable || isExporting}
              aria-disabled={!isAvailable || isExporting}
              onClick={() => {
                if (!isAvailable) return
                if (f.id === 'encrypted') setShowPassword(true)
                else { void handleExport(f.id) }
              }}
              className={cn(
                'group flex flex-col rounded-lg border bg-card p-4 text-left transition-all focus-ring',
                isAvailable
                  ? 'border-border hover:border-saffron/30 hover:shadow-md hover-lift'
                  : 'cursor-not-allowed border-dashed border-border/60 bg-muted/40',
                // A second export while one is running would download the same
                // library twice; the cards all wait for the first to settle.
                isExporting && 'cursor-wait opacity-60',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md',
                    COLOR_MAP[f.color],
                    !isAvailable && 'opacity-50 grayscale',
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
                'mb-1 font-serif text-body-lg font-semibold',
                isAvailable ? 'text-ink group-hover:text-saffron-deep' : 'text-ink-mute',
              )}>
                {f.name}
              </h3>
              <p className="flex-1 text-label-lg leading-relaxed text-ink-mute">
                {f.description}
              </p>
              {isAvailable ? (
                <div className="mt-3 flex items-center gap-1 text-label font-medium text-saffron-deep opacity-0 transition-opacity group-hover:opacity-100">
                  <Download className="h-3 w-3" />
                  {translate('export.grid.exportNow')}
                  <ArrowRight className="h-3 w-3" />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1 text-label font-medium text-ink-faint">
                  {translate('export.grid.notAvailable')}
                </div>
              )}
            </button>
          )
        })}
      </div>
      )}
    </motion.section>
  )
})

ExportFormatGrid.displayName = 'ExportFormatGrid'
