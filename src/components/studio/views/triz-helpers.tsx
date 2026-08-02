'use client'

import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextInput } from '../ui/shared-primitives'

export function ParamPicker({
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
          aria-label="Search TRIZ parameters"
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

export function ContradictionChip({ n, label, accent }: { n: number; label: string; accent: 'saffron' | 'clay' }) {
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
