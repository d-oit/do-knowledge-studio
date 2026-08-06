'use client'

import { memo } from 'react'
import { FileText, Download, Shield, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { FORMATS, COLOR_MAP } from './export-helpers'
import type { ExportFormatId } from './export-helpers'
import type { Entity, ViewId } from '@/lib/studio/types'

interface ExportFormatGridProps {
  entities: Entity[]
  setView: (view: ViewId) => void
  setShowPassword: (show: boolean) => void
  handleExport: (format: ExportFormatId) => Promise<void>
}

export const ExportFormatGrid = memo(({
  entities,
  setView,
  setShowPassword,
  handleExport,
}: ExportFormatGridProps) => {
  const reducedMotion = useReducedMotion()

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="mb-8"
    >
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold text-ink">Export knowledge</h2>
        <p className="mt-1 text-[13px] text-ink-mute">
          Your data is local. Export it whenever you want — for backup, sharing, or migration.
        </p>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <Download aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-ink-faint/40" />
          <p className="text-[13px] text-ink-mute">No entities to export yet. Create some content first.</p>
          <button
            onClick={() => setView('editor')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            <FileText className="h-3.5 w-3.5" />
            Create entity
          </button>
        </div>
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
              disabled={!isAvailable}
              aria-disabled={!isAvailable}
              onClick={() => {
                if (!isAvailable) return
                if (f.id === 'encrypted') setShowPassword(true)
                else { handleExport(f.id) }
              }}
              className={cn(
                'group flex flex-col rounded-lg border bg-card p-4 text-left transition-all focus-ring',
                isAvailable
                  ? 'border-border hover:border-saffron/30 hover:shadow-md hover-lift'
                  : 'cursor-not-allowed border-dashed border-border/60 bg-muted/40',
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
                'mb-1 font-serif text-[15px] font-semibold',
                isAvailable ? 'text-ink group-hover:text-saffron-deep' : 'text-ink-mute',
              )}>
                {f.name}
              </h3>
              <p className="flex-1 text-[12px] leading-relaxed text-ink-mute">
                {f.description}
              </p>
              {isAvailable ? (
                <div className="mt-3 flex items-center gap-1 text-label font-medium text-saffron-deep opacity-0 transition-opacity group-hover:opacity-100">
                  <Download className="h-3 w-3" />
                  Export now
                  <ArrowRight className="h-3 w-3" />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1 text-label font-medium text-ink-faint">
                  Not yet available
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
