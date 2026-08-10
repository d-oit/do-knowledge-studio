'use client'

import { ArrowRight, RotateCcw, Copy, Check, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { TRIZ_PARAMETERS, type TrizPrinciple } from '@/lib/studio/triz-data'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { ContradictionChip } from './triz-helpers'

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
  const { name, id, description, examples } = principle
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.08 }}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:border-saffron/30 hover:shadow-sm hover-lift"
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-saffron to-clay font-serif text-[14px] font-bold text-white shadow-sm">
          #{id}
        </div>
        <button
          type="button"
          onClick={() => { onCopy(`${name}: ${description}`, id) }}
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Copy principle"
        >
          {copied === id ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <h3 className="mb-1.5 font-serif text-[15px] font-semibold leading-tight text-ink">
        {name}
      </h3>
      <p className="mb-2 flex-1 text-[12px] leading-relaxed text-ink-mute">{description}</p>
      {examples.length > 0 && (
        <div className="mt-auto border-t border-border pt-2">
          <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-faint">Examples</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-ink-mute">
            {examples.slice(0, 3).map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

interface ResultsSummaryProps {
  improving: number
  worsening: number
  hasSuggestions: boolean
}

const ResultsSummary = ({ improving, worsening, hasSuggestions }: ResultsSummaryProps) => (
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
      {hasSuggestions
        ? ' TRIZ suggests these inventive principles:'
        : ' No principles found for this pair in the matrix. Try a different combination.'}
    </p>
  </div>
)

interface ResultsPrinciplesProps {
  suggestedPrinciples: TrizPrinciple[]
  copied: number | null
  onCopy: (text: string, id: number) => void
  reducedMotion: boolean
}

const ResultsPrinciples = ({
  suggestedPrinciples,
  copied,
  onCopy,
  reducedMotion,
}: ResultsPrinciplesProps) => {
  if (suggestedPrinciples.length === 0) return null
  return (
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
        {suggestedPrinciples.map((principle, index) => (
          <PrincipleCard
            key={principle.id}
            principle={principle}
            index={index}
            copied={copied}
            onCopy={onCopy}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </>
  )
}

interface ResultsActionsProps {
  onReset: () => void
  onChangeParams: () => void
}

const ResultsActions = ({ onReset, onChangeParams }: ResultsActionsProps) => (
  <div className="mt-6 flex items-center gap-2">
    <button
      type="button"
      onClick={onReset}
      className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Try another contradiction
    </button>
    <button
      type="button"
      onClick={onChangeParams}
      className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
    >
      Change parameters
    </button>
  </div>
)

export interface TrizResultsViewProps {
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
      <ResultsSummary
        improving={improving}
        worsening={worsening}
        hasSuggestions={suggestedPrinciples.length > 0}
      />
      <ResultsPrinciples
        suggestedPrinciples={suggestedPrinciples}
        copied={copied}
        onCopy={onCopy}
        reducedMotion={reducedMotion}
      />
      <ResultsActions onReset={onReset} onChangeParams={onChangeParams} />
    </motion.div>
  )
}
