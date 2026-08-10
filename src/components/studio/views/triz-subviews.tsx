'use client'

import { useMemo } from 'react'
import {
  Grid3X3,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  Eye,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  TRIZ_PARAMETERS,
  TRIZ_PRINCIPLES,
  TRIZ_MATRIX,
  type TrizPrinciple,
} from '@/lib/studio/triz-data'
import { TextInput, ToggleButtonGroup } from '../ui/shared-primitives'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { ContradictionChip } from './triz-helpers'

type TrizViewId = 'pick' | 'results' | 'matrix'

/** Shared filter: maps TRIZ parameters to selectable items and filters by query. */
export const filterParams = (query: string) =>
  TRIZ_PARAMETERS.map((p, i) => ({ label: p, index: i })).filter(
    (p) => !query || p.label.toLowerCase().includes(query.toLowerCase()),
  )

// ---------------------------------------------------------------------------
// TrizHeader
// ---------------------------------------------------------------------------

interface TrizHeaderProps {
  view: TrizViewId
  onViewChange: (view: TrizViewId) => void
  resultsCount: number
  hasSelection: boolean
  onReset: () => void
}

/** Header with view toggle buttons, branding, and reset action for the TRIZ matrix. */
export const TrizHeader = ({
  view,
  onViewChange,
  resultsCount,
  hasSelection,
  onReset,
}: TrizHeaderProps) => {
  const reducedMotion = useReducedMotion()
  const toggleClasses = (active: boolean) =>
    cn(
      'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-ink-mute hover:text-ink',
    )
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
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

      {/* View toggle + Reset */}
      <div className="mt-4 flex items-center gap-4">
        <ToggleButtonGroup label="View">
          <button
            onClick={() => { onViewChange('pick') }}
            aria-pressed={view === 'pick'}
            className={toggleClasses(view === 'pick')}
          >
            <List className="mr-1 inline h-3 w-3" />
            Pick
          </button>
          <button
            onClick={() => { onViewChange('matrix') }}
            aria-pressed={view === 'matrix'}
            className={toggleClasses(view === 'matrix')}
          >
            <Grid3X3 className="mr-1 inline h-3 w-3" />
            Matrix
          </button>
          {resultsCount > 0 && (
            <button
              onClick={() => { onViewChange('results') }}
              aria-pressed={view === 'results'}
              className={toggleClasses(view === 'results')}
            >
              <Sparkles className="mr-1 inline h-3 w-3" />
              Results ({resultsCount})
            </button>
          )}
        </ToggleButtonGroup>

        {hasSelection && (
          <button
            onClick={onReset}
            className="ml-auto flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-label font-medium text-ink-soft transition-colors hover:text-ink focus-ring"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// TrizMatrixView
// ---------------------------------------------------------------------------

interface TrizMatrixViewProps {
  matrixSearch: string
  onMatrixSearchChange: (value: string) => void
  improving: number | null
  worsening: number | null
  onSelectCell: (improving: number, worsening: number) => void
}

/** Full contradiction matrix table with search filtering and selection highlighting. */
export const TrizMatrixView = ({
  matrixSearch,
  onMatrixSearchChange,
  improving,
  worsening,
  onSelectCell,
}: TrizMatrixViewProps) => {
  const reducedMotion = useReducedMotion()
  const matrixHighlight =
    improving !== null && worsening !== null ? `${improving}-${worsening}` : null
  const filtered = useMemo(() => filterParams(matrixSearch), [matrixSearch])
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
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
          onChange={(e) => { onMatrixSearchChange(e.target.value) }}
          placeholder="Filter parameters…"
          aria-label="Filter TRIZ contradiction matrix parameters"
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
                {filtered.map(({ label, index }) => (
                  <th
                    key={index}
                    className={cn(
                      'px-1.5 py-1.5 text-center font-medium',
                      improving === index ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-faint',
                    )}
                    title={label}
                  >
                    {index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ label: rowLabel, index: rowIndex }) => (
                <tr key={rowIndex}>
                  <td
                    className={cn(
                      'sticky left-0 z-10 whitespace-nowrap px-2 py-1 font-medium',
                      worsening === rowIndex
                        ? 'bg-rose-50 text-clay dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-card text-ink-faint',
                    )}
                    title={rowLabel}
                  >
                    <span className="mr-1 font-mono text-caption">{rowIndex + 1}</span>
                    {rowLabel.length > 12 ? `${rowLabel.slice(0, 12)}…` : rowLabel}
                  </td>
                  {filtered.map(({ index: colIndex, label: colLabel }) => {
                    const key = `${rowIndex}-${colIndex}`
                    return (
                      <MatrixCell
                        key={colIndex}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                        rowLabel={rowLabel}
                        colLabel={colLabel}
                        hasEntry={key in TRIZ_MATRIX}
                        isHighlighted={matrixHighlight === key}
                        onSelectCell={onSelectCell}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

interface MatrixCellProps {
  rowIndex: number
  colIndex: number
  rowLabel: string
  colLabel: string
  hasEntry: boolean
  isHighlighted: boolean
  onSelectCell: (improving: number, worsening: number) => void
}

/** Single selectable cell in the contradiction matrix with keyboard support. */
const MatrixCell = ({
  rowIndex,
  colIndex,
  rowLabel,
  colLabel,
  hasEntry,
  isHighlighted,
  onSelectCell,
}: MatrixCellProps) => {
  const cellLabel = `Principles for improving ${colLabel} while worsening ${rowLabel}`
  const cellClasses = cn(
    'min-h-[44px] min-w-[44px] px-1 py-1 text-center',
    isHighlighted
      ? 'bg-saffron-soft font-bold text-saffron-deep'
      : 'bg-muted/50 text-ink-mute hover:bg-saffron-soft/50',
  )
  return (
    <td key={colIndex} className="p-0 text-center">
      {hasEntry ? (
        <button
          type="button"
          aria-label={cellLabel}
          aria-pressed={isHighlighted}
          className={cn(cellClasses, 'focus-ring')}
          onClick={() => { onSelectCell(colIndex, rowIndex) }}
        >
          ●
        </button>
      ) : (
        <span className="inline-block min-h-[44px] min-w-[44px] px-1 py-1 text-center text-ink-faint/30">
          ·
        </span>
      )}
    </td>
  )
}

// ---------------------------------------------------------------------------
// TrizResultsView
// ---------------------------------------------------------------------------

interface TrizResultsViewProps {
  improving: number | null
  worsening: number | null
  suggestedPrinciples: TrizPrinciple[]
  copied: number | null
  onCopy: (text: string, id: number) => void
  onReset: () => void
  onChangeParams: () => void
}

/** Results view showing suggested inventive principles for the selected contradiction. */
export const TrizResultsView = ({
  improving,
  worsening,
  suggestedPrinciples,
  copied,
  onCopy,
  onReset,
  onChangeParams,
}: TrizResultsViewProps) => {
  const reducedMotion = useReducedMotion()
  if (improving === null || worsening === null) return null
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      aria-live="polite"
    >
      {/* Contradiction summary */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 text-label font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Your contradiction
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ContradictionChip n={improving + 1} label={TRIZ_PARAMETERS.at(improving) ?? ''} accent="saffron" />
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          <ContradictionChip n={worsening + 1} label={TRIZ_PARAMETERS.at(worsening) ?? ''} accent="clay" />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
          You want to improve <strong className="text-ink-soft">{TRIZ_PARAMETERS.at(improving)?.toLowerCase() ?? ''}</strong>,
          but doing so worsens <strong className="text-ink-soft">{TRIZ_PARAMETERS.at(worsening)?.toLowerCase() ?? ''}</strong>.
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
              <PrincipleCard
                key={p.id}
                principle={p}
                index={i}
                copied={copied}
                onCopy={onCopy}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </>
      )}

      {/* Try another */}
      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={onReset}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try another contradiction
        </button>
        <button
          onClick={onChangeParams}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
        >
          Change parameters
        </button>
      </div>
    </motion.div>
  )
}

interface PrincipleCardProps {
  principle: TrizPrinciple
  index: number
  copied: number | null
  onCopy: (text: string, id: number) => void
  reducedMotion: boolean
}

/** Card displaying a single suggested inventive principle with a copy action. */
const PrincipleCard = ({
  principle,
  index,
  copied,
  onCopy,
  reducedMotion,
}: PrincipleCardProps) => {
  const p = principle
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.08 }}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:border-saffron/30 hover:shadow-sm hover-lift"
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-saffron to-clay font-serif text-[14px] font-bold text-white shadow-sm">
          #{p.id}
        </div>
        <button
          onClick={() => { onCopy(`${p.name}: ${p.description}`, p.id) }}
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
  )
}
