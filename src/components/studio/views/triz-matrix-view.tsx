'use client'

import { useMemo } from 'react'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { TRIZ_MATRIX, TRIZ_PARAMETERS, TRIZ_PRINCIPLES } from '@/lib/studio/triz-data'
import { TextInput } from '../ui/shared-primitives'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { filterParams } from './triz-view-utils'

type FilteredParameter = ReturnType<typeof filterParams>[number]

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
  const cellLabel = `Principles for improving ${rowLabel} while worsening ${colLabel}`
  const cellClasses = cn(
    'min-h-[44px] min-w-[44px] px-1 py-1 text-center',
    isHighlighted
      ? 'bg-saffron-soft font-bold text-saffron-deep'
      : 'bg-muted/50 text-ink-mute hover:bg-saffron-soft/50',
  )
  return (
    <td className="p-0 text-center">
      {hasEntry ? (
        <button
          type="button"
          aria-label={cellLabel}
          className={cn(cellClasses, 'focus-ring')}
          onClick={() => { onSelectCell(rowIndex, colIndex) }}
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

interface MatrixRowProps {
  rowIndex: number
  rowLabel: string
  filtered: FilteredParameter[]
  improving: number | null
  matrixHighlight: string | null
  onSelectCell: (improving: number, worsening: number) => void
}

/** Matrix row with a sticky improving-parameter label and selectable cells. */
const MatrixRow = ({
  rowIndex,
  rowLabel,
  filtered,
  improving,
  matrixHighlight,
  onSelectCell,
}: MatrixRowProps) => (
  <tr>
    <td
      className={cn(
        'sticky left-0 z-10 whitespace-nowrap px-2 py-1 font-medium',
        improving === rowIndex
          ? 'bg-saffron-soft text-saffron-deep'
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
)

interface MatrixTableProps {
  filtered: FilteredParameter[]
  improving: number | null
  worsening: number | null
  matrixHighlight: string | null
  onSelectCell: (improving: number, worsening: number) => void
}

/** Matrix table with an improving-parameter header and contradiction rows. */
const MatrixTable = ({
  filtered,
  improving,
  worsening,
  matrixHighlight,
  onSelectCell,
}: MatrixTableProps) => (
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
              worsening === index ? 'bg-rose-50 text-clay dark:bg-rose-950/40 dark:text-rose-300' : 'text-ink-faint',
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
        <MatrixRow
          key={rowIndex}
          rowIndex={rowIndex}
          rowLabel={rowLabel}
          filtered={filtered}
          improving={improving}
          matrixHighlight={matrixHighlight}
          onSelectCell={onSelectCell}
        />
      ))}
    </tbody>
  </table>
)

export interface TrizMatrixViewProps {
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
            {TRIZ_PARAMETERS.length} parameters × {TRIZ_PRINCIPLES.length} principles
          </span>
        </div>
        <p className="mb-3 text-[12px] text-ink-mute">
          Click any cell to see the recommended inventive principles. Highlighted rows/columns show your current selection.
        </p>
        <TextInput
          value={matrixSearch}
          onChange={(event) => { onMatrixSearchChange(event.target.value) }}
          placeholder="Filter parameters…"
          aria-label="Filter TRIZ contradiction matrix parameters"
          className="mb-3"
        />
        <div className="overflow-auto rounded-md border border-border">
          <MatrixTable
            filtered={filtered}
            improving={improving}
            worsening={worsening}
            matrixHighlight={matrixHighlight}
            onSelectCell={onSelectCell}
          />
        </div>
      </div>
    </motion.div>
  )
}
