'use client'

import { useMemo, useCallback } from 'react'
import { useStudioStore, useStats } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import {
  FileText,
  Lightbulb,
  User,
  FolderKanban,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  Quote,
  Clock,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

/** Icon lookup for entity types */
const ENTITY_ICONS: Record<string, typeof FileText> = {
  FileText,
  Lightbulb,
  User,
  FolderKanban,
}

/** Locale for date/time formatting — extract to config when i18n lands. */
const LOCALE = 'en-US'

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: 'auto',
})

const RELATIVE_DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
]

function formatRelativeTime(dateStr: string): string {
  const diffSeconds = Math.round(
    (new Date(dateStr).getTime() - Date.now()) / 1000,
  )
  let duration = diffSeconds
  for (const [amount, unit] of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return relativeTimeFormatter.format(Math.round(duration), unit)
    }
    duration /= amount
  }
  return shortDateFormatter.format(new Date(dateStr))
}

const RECENT_LIMIT = 6

export function HomeView() {
  const setView = useStudioStore((s) => s.setView)
  const startNew = useStudioStore((s) => s.startNew)
  const startEdit = useStudioStore((s) => s.startEdit)
  const entities = useStudioStore((s) => s.entities)
  const stats = useStats()
  const reducedMotion = useReducedMotion()

  const fadeAnim = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0 } as const, animate: { opacity: 1 }, transition: { duration: 0.35 } }

  const today = useMemo(() => dateFormatter.format(new Date()), [])

  const recentEntities = useMemo(
    () =>
      [...entities]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RECENT_LIMIT),
    [entities],
  )

  const totalConnections = useMemo(
    () => entities.reduce((sum, e) => sum + e.links.length, 0),
    [entities],
  )

  const typeEntries = useMemo(
    () =>
      (Object.entries(stats.byType) as [string, number][]).map(
        ([t, c]) => [t as keyof typeof ENTITY_TYPE_META, c] as const,
      ),
    [stats.byType],
  )

  const handleOpenEntity = useCallback(
    (id: string) => {
      startEdit(id)
    },
    [startEdit],
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10 lg:py-12">
      {/* 1. Compact greeting row */}
      <motion.section
        {...fadeAnim}
        className="mb-8 flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-saffron-deep">
          {today}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            <FileText className="h-4 w-4" />
            New entity
          </button>
          <button
            onClick={() => setView('chat')}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-saffron/40 hover:text-ink focus-ring"
          >
            <Sparkles className="h-4 w-4 text-saffron" />
            Ask your library
          </button>
        </div>
      </motion.section>

      {/* 2. Recent work */}
      <motion.section {...fadeAnim} className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ink">Recent work</h2>
          {entities.length > 0 && (
            <button
              onClick={() => setView('library')}
              className="flex items-center gap-1 text-[12px] font-medium text-saffron-deep transition-colors hover:text-saffron focus-ring"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {recentEntities.length === 0 ? (
          <EmptyState onCreate={startNew} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {recentEntities.map((entity) => {
              const meta = ENTITY_TYPE_META[entity.type]
              const Icon = ENTITY_ICONS[meta.icon] || FileText
              return (
                <li key={entity.id}>
                  <button
                    onClick={() => { handleOpenEntity(entity.id) }}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-saffron-soft/30 focus-ring"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                        meta.bg,
                        meta.text,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink group-hover:text-saffron-deep">
                          {entity.name}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide',
                            meta.bg,
                            meta.text,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="truncate text-[12px] text-ink-mute">
                        {entity.description}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-label text-ink-faint">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(entity.updatedAt)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </motion.section>

      {/* 3. Compact stats row */}
      <section className="mb-8 flex flex-wrap gap-6 rounded-lg border border-border bg-card px-5 py-4">
        <CompactStat
          label="Entities"
          value={stats.total}
          icon={FileText}
          onClick={() => setView('library')}
        />
        <CompactStat
          label="Claims"
          value={stats.claims}
          icon={Quote}
          onClick={() => setView('library')}
        />
        <CompactStat
          label="Verified"
          value={stats.verified}
          icon={CheckCircle2}
          onClick={() => setView('library')}
        />
        <CompactStat
          label="Connections"
          value={totalConnections}
          icon={TrendingUp}
          onClick={() => setView('graph')}
        />
      </section>

      {/* 4. Type breakdown */}
      {stats.total > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">By type</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              {typeEntries.map(([type, count]) => {
                const meta = ENTITY_TYPE_META[type as keyof typeof ENTITY_TYPE_META]
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={type}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                        <span className="font-medium text-ink-soft">{meta.label}</span>
                      </div>
                      <span className="font-mono text-ink-mute">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={reducedMotion ? false : { width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { duration: 0.6, ease: 'easeOut' }
                        }
                        className={cn('h-full rounded-full', meta.dot)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 5. Tip */}
      <section className="rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/40 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-saffron" />
          <span className="text-label font-semibold uppercase tracking-wide text-saffron-deep">
            Tip
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-ink-soft">
          Use{' '}
          <kbd className="rounded border border-border bg-background px-1 font-mono text-caption">
            &#x2318;K
          </kbd>{' '}
          to jump anywhere, or mark text in the Editor as a Claim to add evidence and verification.
        </p>
      </section>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
      <FileText className="mx-auto mb-3 h-8 w-8 text-ink-faint/40" />
      <p className="text-[13px] text-ink-mute">
        No entities yet. Create your first one to get started.
      </p>
      <button
        onClick={onCreate}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
      >
        <FileText className="h-3.5 w-3.5" />
        Create entity
      </button>
    </div>
  )
}

function CompactStat({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string
  value: number
  icon: typeof FileText
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 transition-opacity hover:opacity-80 focus-ring"
    >
      <Icon className="h-4 w-4 text-ink-faint group-hover:text-saffron" />
      <span className="font-mono text-[15px] font-semibold text-ink">{value}</span>
      <span className="text-label uppercase tracking-wide text-ink-faint">{label}</span>
    </button>
  )
}
