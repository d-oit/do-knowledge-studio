'use client'

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

const ICONS: Record<string, typeof FileText> = {
  FileText,
  Lightbulb,
  User,
  FolderKanban,
}

export function HomeView() {
  const { setView, startNew, entities, startEdit } = useStudioStore()
  const stats = useStats()

  const typeEntries = (Object.entries(stats.byType) as [string, number][]) as [
    keyof typeof ENTITY_TYPE_META,
    number,
  ][]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10 lg:py-12">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-saffron">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-ink">
          Your local thinking studio.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Capture ideas as entities, connect them as a graph, ask questions of your library, and
          resolve contradictions with TRIZ — all offline, all yours.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
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

      {/* Stats grid */}
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Entities"
          value={stats.total}
          icon={FileText}
          accent="saffron"
          onClick={() => setView('library')}
        />
        <StatCard
          label="Claims"
          value={stats.claims}
          icon={Quote}
          accent="sky"
          onClick={() => setView('library')}
        />
        <StatCard
          label="Verified"
          value={stats.verified}
          icon={CheckCircle2}
          accent="sage"
          onClick={() => setView('library')}
        />
        <StatCard
          label="Connections"
          value={entities.reduce((n, e) => n + e.links.length, 0)}
          icon={TrendingUp}
          accent="clay"
          onClick={() => setView('graph')}
        />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">Recently updated</h2>
            {stats.recent.length > 0 && (
              <button
                onClick={() => setView('library')}
                className="flex items-center gap-1 text-[12px] font-medium text-saffron-deep transition-colors hover:text-saffron"
              >
                View all
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          {stats.recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-ink-faint/40" />
              <p className="text-[13px] text-ink-mute">No entities yet. Create your first one to get started.</p>
              <button
                onClick={startNew}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
              >
                <FileText className="h-3.5 w-3.5" />
                Create entity
              </button>
            </div>
          ) : (
          <div className="stagger-children space-y-2">
            {stats.recent.map((e, i) => {
              const meta = ENTITY_TYPE_META[e.type]
              const Icon = ICONS[meta.icon] || FileText
              return (
                <button
                  key={e.id}
                  style={{ '--i': i } as React.CSSProperties}
                  onClick={() => startEdit(e.id)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-sm hover-lift focus-ring"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                      meta.bg,
                      meta.text,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-ink">{e.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">
                        {meta.label}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-ink-mute">{e.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[11px] text-ink-faint">
                    <Clock className="h-3 w-3" />
                    {new Date(e.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </button>
              )
            })}
          </div>
          )}
        </section>

        {/* Type breakdown */}
        <section>
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">By type</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              {typeEntries.map(([type, count]) => {
                const meta = ENTITY_TYPE_META[type]
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
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', meta.dot)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/40 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-saffron" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-saffron-deep">
                Tip
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Use <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">⌘K</kbd> to
              jump anywhere, or mark text in the Editor as a Claim to add evidence and verification.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string
  value: number
  icon: typeof FileText
  accent: 'saffron' | 'sky' | 'sage' | 'clay'
  onClick?: () => void
}) {
  const accents: Record<string, string> = {
    saffron: 'text-saffron bg-saffron-soft',
    sky: 'text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40',
    sage: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40',
    clay: 'text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40',
  }
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-md border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-sm hover-lift focus-ring"
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', accents[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-mono text-2xl font-semibold leading-none text-ink">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      </div>
    </button>
  )
}
