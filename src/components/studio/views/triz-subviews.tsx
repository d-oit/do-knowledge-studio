'use client'

import {
  Grid3X3,
  RotateCcw,
  Sparkles,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ToggleButtonGroup } from '../ui/shared-primitives'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { ParamPicker } from './triz-helpers'
import { filterParams } from './triz-view-utils'

export { filterParams } from './triz-view-utils'

type TrizViewId = 'pick' | 'results' | 'matrix'

interface TrizHeaderProps {
  view: TrizViewId
  onViewChange: (view: TrizViewId) => void
  resultsCount: number
  hasSelection: boolean
  onReset: () => void
}

const TrizBranding = () => (
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
)

interface TrizHeaderControlsProps {
  view: TrizViewId
  onViewChange: (view: TrizViewId) => void
  resultsCount: number
  hasSelection: boolean
  onReset: () => void
}

const TrizHeaderControls = ({
  view,
  onViewChange,
  resultsCount,
  hasSelection,
  onReset,
}: TrizHeaderControlsProps) => {
  const toggleClasses = (active: boolean) =>
    cn(
      'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-ink-mute hover:text-ink',
    )
  return (
    <div className="mt-4 flex items-center gap-4">
      <ToggleButtonGroup label="View">
        <button
          type="button"
          onClick={() => { onViewChange('pick') }}
          aria-pressed={view === 'pick'}
          className={toggleClasses(view === 'pick')}
        >
          <List className="mr-1 inline h-3 w-3" />
          Pick
        </button>
        <button
          type="button"
          onClick={() => { onViewChange('matrix') }}
          aria-pressed={view === 'matrix'}
          className={toggleClasses(view === 'matrix')}
        >
          <Grid3X3 className="mr-1 inline h-3 w-3" />
          Matrix
        </button>
        {resultsCount > 0 && (
          <button
            type="button"
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
          type="button"
          onClick={onReset}
          className="ml-auto flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-label font-medium text-ink-soft transition-colors hover:text-ink focus-ring"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  )
}

/** Header with view toggle buttons, branding, and reset action for the TRIZ matrix. */
export const TrizHeader = (props: TrizHeaderProps) => {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="mb-6"
    >
      <TrizBranding />
      <TrizHeaderControls {...props} />
    </motion.div>
  )
}

interface TrizPickViewProps {
  improving: number | null
  worsening: number | null
  search: string
  filteredParams: ReturnType<typeof filterParams>
  onImprovingChange: (index: number) => void
  onWorseningChange: (index: number) => void
  onSearchChange: (value: string) => void
}

/** Pick view containing the improving and worsening parameter selectors. */
export const TrizPickView = ({
  improving,
  worsening,
  search,
  filteredParams,
  onImprovingChange,
  onWorseningChange,
  onSearchChange,
}: TrizPickViewProps) => {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <ParamPicker
        title="Improving parameter"
        subtitle="What you want to make better"
        accent="saffron"
        selected={improving}
        onSelect={onImprovingChange}
        search={search}
        setSearch={onSearchChange}
        filtered={filteredParams}
        disabled={[]}
      />
      <ParamPicker
        title="Worsening parameter"
        subtitle="What gets worse as a result"
        accent="clay"
        selected={worsening}
        onSelect={onWorseningChange}
        search={search}
        setSearch={onSearchChange}
        filtered={filteredParams}
        disabled={improving !== null ? [improving] : []}
      />
    </motion.div>
  )
}
