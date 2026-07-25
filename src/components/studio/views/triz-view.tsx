'use client'

import {
  Grid3X3,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Search,
  Sparkles,
  Eye,
  List,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { TRIZ_PARAMETERS, TRIZ_PRINCIPLES, TRIZ_MATRIX, lookupPrinciples } from '@/lib/studio/triz-data'
import { TextInput, ToggleButtonGroup } from '../ui/shared-primitives'

export function TrizView() {
  const [improving, setImproving] = useState<number | null>(null)
  const [worsening, setWorsening] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [view, setView] = useState<'pick' | 'results' | 'matrix'>('pick')
  const [matrixSearch, setMatrixSearch] = useState('')

  const suggestedPrinciples = useMemo(() => {
    if (improving === null || worsening === null) return []
    return lookupPrinciples(improving, worsening)
  }, [improving, worsening])

  const filteredParams = useMemo(
    () =>
      TRIZ_PARAMETERS
        .map((p, i) => ({ label: p, index: i }))
        .filter((p) => !search || p.label.toLowerCase().includes(search.toLowerCase())),
    [search],
  )

  const matrixHighlight = useMemo(() => {
    if (improving === null || worsening === null) return null
    return `${improving}-${worsening}`
  }, [improving, worsening])

  const filteredMatrixParams = useMemo(
    () =>
      TRIZ_PARAMETERS
        .map((p, i) => ({ label: p, index: i }))
        .filter((p) => !matrixSearch || p.label.toLowerCase().includes(matrixSearch.toLowerCase())),
    [matrixSearch],
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
    setTimeout(() => { setCopied(null) }, 2000)
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
              <span className="rounded-full border border-dashed border-saffron/50 px-2 py-0 text-badge font-semibold uppercase tracking-wide text-saffron-deep">
                Lab
              </span>
            </div>
            <p className="text-[12px] text-ink-mute">
              Pick an improving parameter and a worsening parameter — the matrix suggests inventive principles.
            </p>
          </div>
        </div>

        {/* View toggle + Stepper */}
        <div className="mt-4 flex items-center gap-4">
          <ToggleButtonGroup label="View">
            <button
              onClick={() => { setView('pick') }}
              aria-pressed={view === 'pick'}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
                view === 'pick'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              <List className="mr-1 inline h-3 w-3" />
              Pick
            </button>
            <button
              onClick={() => { setView('matrix') }}
              aria-pressed={view === 'matrix'}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
                view === 'matrix'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              <Grid3X3 className="mr-1 inline h-3 w-3" />
              Matrix
            </button>
            {suggestedPrinciples.length > 0 && (
              <button
                onClick={() => { setView('results') }}
                aria-pressed={view === 'results'}
                className={cn(
                  'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
                  view === 'results'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-ink-mute hover:text-ink',
                )}
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                Results ({suggestedPrinciples.length})
              </button>
            )}
          </ToggleButtonGroup>

          {(improving !== null || worsening !== null) && (
            <button
              onClick={handleReset}
              className="ml-auto flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-label font-medium text-ink-soft transition-colors hover:text-ink focus-ring"
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

      {/* Matrix view */}
      {view === 'matrix' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-saffron" />
              <h2 className="font-serif text-[15px] font-semibold text-ink">Contradiction Matrix</h2>
              <span className="text-caption text-ink-faint">
                {Object.keys(TRIZ_PARAMETERS).length} parameters × {TRIZ_PRINCIPLES.length} principles
              </span>
            </div>
            <p className="mb-3 text-[12px] text-ink-mute">
              Click any cell to see the recommended inventive principles. Highlighted rows/columns show your current selection.
            </p>
            <TextInput
              value={matrixSearch}
              onChange={(e) => { setMatrixSearch(e.target.value) }}
              placeholder="Filter parameters…"
              className="mb-3"
            />
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-[10px]">
                <caption className="sr-only">TRIZ Contradiction Matrix</caption>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-semibold text-ink-faint">
                      ↓ Improving → Worsening
                    </th>
                    {filteredMatrixParams.map(({ index }) => (
                      <th
                        key={index}
                        className={cn(
                          'px-1.5 py-1.5 text-center font-medium',
                          improving === index ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-faint',
                        )}
                        title={TRIZ_PARAMETERS[index]}
                      >
                        {index + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrixParams.map(({ label: rowLabel, index: rowIndex }) => (
                    <tr key={rowIndex}>
                      <td
                        className={cn(
                          'sticky left-0 z-10 whitespace-nowrap px-2 py-1 font-medium',
                          worsening === rowIndex ? 'bg-rose-50 text-clay dark:bg-rose-950/40 dark:text-rose-300' : 'bg-card text-ink-faint',
                        )}
                        title={rowLabel}
                      >
                        <span className="mr-1 font-mono text-caption">{rowIndex + 1}</span>
                        {rowLabel.length > 12 ? `${rowLabel.slice(0, 12)}…` : rowLabel}
                      </td>
                      {filteredMatrixParams.map(({ index: colIndex }) => {
                        const key = `${rowIndex}-${colIndex}`
                        const hasEntry = key in TRIZ_MATRIX
                        const isHighlighted = matrixHighlight === key
                        return (
                          <td
                            key={colIndex}
                            tabIndex={hasEntry ? 0 : undefined}
                            role={hasEntry ? 'button' : undefined}
                            aria-label={hasEntry ? `Principles for improving ${rowLabel} vs ${filteredMatrixParams[colIndex]?.label ?? colIndex}` : undefined}
                            className={cn(
                              'px-1 py-1 text-center min-h-[44px] min-w-[44px]',
                              isHighlighted
                                ? 'bg-saffron-soft font-bold text-saffron-deep'
                                : hasEntry
                                  ? 'cursor-pointer bg-muted/50 text-ink-mute hover:bg-saffron-soft/50 focus-ring'
                                  : 'text-ink-faint/30',
                            )}
                            onClick={() => {
                              if (hasEntry) {
                                setImproving(colIndex)
                                setWorsening(rowIndex)
                                setView('results')
                              }
                            }}
                            onKeyDown={(e) => {
                              if (hasEntry && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault()
                                setImproving(colIndex)
                                setWorsening(rowIndex)
                                setView('results')
                              }
                            }}
                          >
                            {hasEntry ? '●' : '·'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
            <div className="mb-3 text-label font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Your contradiction
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ContradictionChip n={improving + 1} label={TRIZ_PARAMETERS[improving] ?? ''} accent="saffron" />
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
              <ContradictionChip n={worsening + 1} label={TRIZ_PARAMETERS[worsening] ?? ''} accent="clay" />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
              You want to improve <strong className="text-ink-soft">{TRIZ_PARAMETERS[improving]?.toLowerCase() ?? ''}</strong>,
              but doing so worsens <strong className="text-ink-soft">{TRIZ_PARAMETERS[worsening]?.toLowerCase() ?? ''}</strong>.
              {suggestedPrinciples.length > 0
                ? ' TRIZ suggests these inventive principles:'
                : ' No principles found for this pair in the matrix. Try a different combination.'}
            </p>
          </div>

          {/* Suggested principles */}
          {suggestedPrinciples.length > 0 && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-saffron" />
                <h2 className="font-serif text-lg font-semibold text-ink">
                  Suggested inventive principles
                </h2>
                <span className="rounded-full bg-saffron-soft px-2 py-0 text-label font-semibold text-saffron-deep">
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
                        onClick={() => { handleCopy(`${p.name}: ${p.description}`, p.id) }}
                        className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                    <p className="mb-2 flex-1 text-[12px] leading-relaxed text-ink-mute">{p.description}</p>
                    {p.examples.length > 0 && (
                      <div className="mt-auto border-t border-border pt-2">
                        <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-faint">Examples</p>
                        <ul className="list-inside list-disc space-y-0.5 text-[11px] text-ink-mute">
                          {p.examples.slice(0, 3).map((ex) => (
                            <li key={ex}>{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* Try another */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try another contradiction
            </button>
            <button
              onClick={() => { setView('pick') }}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
            >
              Change parameters
            </button>
          </div>
        </motion.div>
      )}
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
  const accentMap = {
    saffron: { dot: 'bg-saffron', text: 'text-saffron-deep', bg: 'bg-saffron-soft' },
    clay: { dot: 'bg-clay', text: 'text-clay', bg: 'bg-rose-100 dark:bg-rose-950/40' },
  } as const
  const accents = accentMap[accent]

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', accents.dot)} />
          <h2 className="font-serif text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <p className="mt-0.5 text-label text-ink-faint">{subtitle}</p>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <TextInput
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
          placeholder="Search parameters…"
          className="pl-9"
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
              onClick={() => { onSelect(index) }}
              className={cn(
                'flex min-h-[44px] w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors focus-ring',
                isSelected
                  ? cn(accents.bg, accents.text, 'font-semibold')
                  : isDisabled
                    ? 'cursor-not-allowed text-ink-faint/40'
                    : 'text-ink-soft hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-caption font-bold',
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
  const accentStyles = {
    saffron: 'bg-saffron-soft text-saffron-deep border-saffron/30',
    clay: 'bg-rose-100 text-clay border-clay/30 dark:bg-rose-950/40 dark:text-rose-300',
  } as const
  const accents = accentStyles[accent]
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', accents)}>
      <span className="flex h-6 w-6 items-center justify-center rounded bg-paper-raised font-mono text-label font-bold text-ink">
        {n}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  )
}
