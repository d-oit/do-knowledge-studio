'use client'

import { trizParameters, trizPrinciples } from '@/lib/studio/seed-data'
import {
  Grid3X3,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Search,
  Sparkles,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export function TrizView() {
  const [improving, setImproving] = useState<number | null>(null)
  const [worsening, setWorsening] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [view, setView] = useState<'pick' | 'matrix' | 'results'>('pick')

  // Deterministic principle selection from the pair
  const suggestedPrinciples = useMemo(() => {
    if (improving === null || worsening === null) return []
    const seed = (improving * 7 + worsening * 13) % trizPrinciples.length
    const picks = [seed, (seed + 1) % trizPrinciples.length, (seed + 3) % trizPrinciples.length]
    return picks.map((i) => trizPrinciples[i]).filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
  }, [improving, worsening])

  const filteredParams = useMemo(
    () =>
      trizParameters
        .map((p, i) => ({ label: p, index: i }))
        .filter((p) => !search || p.label.toLowerCase().includes(search.toLowerCase())),
    [search],
  )

  const handleReset = () => {
    setImproving(null)
    setWorsening(null)
    setView('pick')
  }

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard?.writeText(text)
    setCopied(id)
    toast.success('Principle copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10 lg:py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-saffron to-clay text-white shadow-sm">
            <Grid3X3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold text-ink">TRIZ Contradiction Matrix</h1>
              <span className="rounded-full border border-dashed border-saffron/50 px-2 py-0 text-[9px] font-semibold uppercase tracking-wide text-saffron">
                Lab
              </span>
            </div>
            <p className="text-[12px] text-ink-mute">
              Pick an improving parameter and a worsening parameter — the matrix suggests inventive principles.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-4 flex items-center gap-2 text-[12px]">
          <Step n={1} active={view === 'pick'} done={improving !== null && worsening !== null}>
            Pick contradiction
          </Step>
          <ArrowRight className="h-3 w-3 text-ink-faint" />
          <Step n={2} active={view === 'results'} done={false}>
            Inventive principles
          </Step>
          {(improving !== null || worsening !== null) && (
            <button
              onClick={handleReset}
              className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink focus-ring"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </motion.div>

      {/* Step 1: Pick contradiction */}
      {view === 'pick' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Improving */}
          <ParamPicker
            title="Improving parameter"
            subtitle="What you want to make better"
            accent="saffron"
            selected={improving}
            onSelect={(i) => {
              setImproving(i)
              if (worsening !== null) setView('results')
            }}
            search={search}
            setSearch={setSearch}
            filtered={filteredParams}
            disabled={[]}
          />

          {/* Worsening */}
          <ParamPicker
            title="Worsening parameter"
            subtitle="What gets worse as a result"
            accent="clay"
            selected={worsening}
            onSelect={(i) => {
              setWorsening(i)
              if (improving !== null) setView('results')
            }}
            search={search}
            setSearch={setSearch}
            filtered={filteredParams}
            disabled={improving !== null ? [improving] : []}
          />
        </motion.div>
      )}

      {/* Step 2: Results */}
      {view === 'results' && improving !== null && worsening !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Contradiction summary */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Your contradiction
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ContradictionChip n={improving + 1} label={trizParameters[improving]} accent="saffron" />
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
              <ContradictionChip n={worsening + 1} label={trizParameters[worsening]} accent="clay" />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
              You want to improve <strong className="text-ink-soft">{trizParameters[improving].toLowerCase()}</strong>,
              but doing so worsens <strong className="text-ink-soft">{trizParameters[worsening].toLowerCase()}</strong>.
              TRIZ suggests these inventive principles:
            </p>
          </div>

          {/* Suggested principles */}
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-saffron" />
            <h2 className="font-serif text-lg font-semibold text-ink">
              Suggested inventive principles
            </h2>
            <span className="rounded-full bg-saffron-soft px-2 py-0 text-[11px] font-semibold text-saffron-deep">
              {suggestedPrinciples.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestedPrinciples.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:border-saffron/30 hover:shadow-sm hover-lift"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-saffron to-clay font-serif text-[14px] font-bold text-white shadow-sm">
                    #{p.id}
                  </div>
                  <button
                    onClick={() => handleCopy(`${p.name}: ${p.description}`, p.id)}
                    className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
                    aria-label="Copy principle"
                  >
                    {copied === p.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <h3 className="mb-1.5 font-serif text-[15px] font-semibold leading-tight text-ink">
                  {p.name}
                </h3>
                <p className="flex-1 text-[12px] leading-relaxed text-ink-mute">{p.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Try another */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try another contradiction
            </button>
            <button
              onClick={() => setView('pick')}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
            >
              Change parameters
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function Step({
  n,
  active,
  done,
  children,
}: {
  n: number
  active: boolean
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
        active ? 'bg-saffron-soft text-saffron-deep' : done ? 'text-emerald-600' : 'text-ink-faint',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
          active ? 'bg-saffron text-white' : done ? 'bg-emerald-500 text-white' : 'bg-muted text-ink-faint',
        )}
      >
        {done ? <Check className="h-2.5 w-2.5" /> : n}
      </span>
      {children}
    </div>
  )
}

function ParamPicker({
  title,
  subtitle,
  accent,
  selected,
  onSelect,
  search,
  setSearch,
  filtered,
  disabled,
}: {
  title: string
  subtitle: string
  accent: 'saffron' | 'clay'
  selected: number | null
  onSelect: (i: number) => void
  search: string
  setSearch: (s: string) => void
  filtered: { label: string; index: number }[]
  disabled: number[]
}) {
  const accents = {
    saffron: { dot: 'bg-saffron', text: 'text-saffron-deep', bg: 'bg-saffron-soft' },
    clay: { dot: 'bg-clay', text: 'text-clay', bg: 'bg-rose-100 dark:bg-rose-950/40' },
  }[accent]

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', accents.dot)} />
          <h2 className="font-serif text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-faint">{subtitle}</p>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parameters…"
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-[12px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
        />
      </div>

      <div className="max-h-[360px] space-y-0.5 overflow-y-auto pr-1">
        {filtered.map(({ label, index }) => {
          const isSelected = selected === index
          const isDisabled = disabled.includes(index)
          return (
            <button
              key={index}
              disabled={isDisabled}
              onClick={() => onSelect(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors focus-ring',
                isSelected
                  ? cn(accents.bg, accents.text, 'font-semibold')
                  : isDisabled
                    ? 'cursor-not-allowed text-ink-faint/40'
                    : 'text-ink-soft hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold',
                  isSelected ? 'bg-paper-raised text-ink' : 'bg-muted text-ink-faint',
                )}
              >
                {index + 1}
              </span>
              <span className="flex-1">{label}</span>
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ContradictionChip({ n, label, accent }: { n: number; label: string; accent: 'saffron' | 'clay' }) {
  const accents = {
    saffron: 'bg-saffron-soft text-saffron-deep border-saffron/30',
    clay: 'bg-rose-100 text-clay border-clay/30 dark:bg-rose-950/40 dark:text-rose-300',
  }[accent]
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', accents)}>
      <span className="flex h-6 w-6 items-center justify-center rounded bg-paper-raised font-mono text-[11px] font-bold text-ink">
        {n}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  )
}
