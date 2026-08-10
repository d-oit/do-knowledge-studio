'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { lookupPrinciples } from '@/lib/studio/triz-data'
import { ParamPicker } from './triz-helpers'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import {
  filterParams,
  TrizHeader,
  TrizMatrixView,
  TrizResultsView,
} from './triz-subviews'

/** TRIZ contradiction matrix view for picking parameters and viewing suggested inventive principles. */
export const TrizView = () => {
  const [improving, setImproving] = useState<number | null>(null)
  const [worsening, setWorsening] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()
  const [view, setView] = useState<'pick' | 'results' | 'matrix'>('pick')
  const [matrixSearch, setMatrixSearch] = useState('')

  const suggestedPrinciples = useMemo(() => {
    if (improving === null || worsening === null) return []
    return lookupPrinciples(improving, worsening)
  }, [improving, worsening])

  const filteredParams = useMemo(() => filterParams(search), [search])

  const handleReset = () => {
    setImproving(null)
    setWorsening(null)
    setView('pick')
  }

  const handleCopy = (text: string, id: number) => {
    try {
      // Clipboard can be unavailable in insecure contexts; rejection is non-fatal.
      navigator.clipboard.writeText(text).catch(() => undefined)
    } catch (error) {
      // Clipboard API missing entirely (e.g. non-secure context) — non-fatal.
      console.error('Clipboard API unavailable:', error)
    }
    setCopied(id)
    toast.success('Principle copied to clipboard')
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => { setCopied(null) }, 2000)
  }

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current) }
  }, [])

  const handleSelectCell = (imp: number, wor: number) => {
    setImproving(imp)
    setWorsening(wor)
    setView('results')
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10 lg:py-8">
      <TrizHeader
        view={view}
        onViewChange={setView}
        resultsCount={suggestedPrinciples.length}
        hasSelection={improving !== null || worsening !== null}
        onReset={handleReset}
      />

      {/* Step 1: Pick contradiction */}
      {view === 'pick' && (
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
        <TrizMatrixView
          matrixSearch={matrixSearch}
          onMatrixSearchChange={setMatrixSearch}
          improving={improving}
          worsening={worsening}
          onSelectCell={handleSelectCell}
        />
      )}

      {/* Step 2: Results */}
      {view === 'results' && (
        <TrizResultsView
          improving={improving}
          worsening={worsening}
          suggestedPrinciples={suggestedPrinciples}
          copied={copied}
          onCopy={handleCopy}
          onReset={handleReset}
          onChangeParams={() => { setView('pick') }}
        />
      )}
    </div>
  )
}
