'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { lookupPrinciples } from '@/lib/studio/triz-data'
import {
  filterParams,
  TrizHeader,
  TrizPickView,
} from './triz-subviews'
import { TrizMatrixView } from './triz-matrix-view'
import { TrizResultsView } from './triz-results-view'

/** TRIZ contradiction matrix view for picking parameters and viewing suggested inventive principles. */
export const TrizView = () => {
  const [improving, setImproving] = useState<number | null>(null)
  const [worsening, setWorsening] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [view, setView] = useState<'pick' | 'results' | 'matrix'>('pick')
  const [matrixSearch, setMatrixSearch] = useState('')

  const suggestedPrinciples = useMemo(
    () => improving === null || worsening === null ? [] : lookupPrinciples(improving, worsening),
    [improving, worsening],
  )

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

  const handleSelectCell = (improvingIndex: number, worseningIndex: number) => {
    setImproving(improvingIndex)
    setWorsening(worseningIndex)
    setView('results')
  }

  const handleImprovingChange = (index: number) => {
    setImproving(index)
    if (worsening !== null) setView('results')
  }

  const handleWorseningChange = (index: number) => {
    setWorsening(index)
    if (improving !== null) setView('results')
  }

  const viewContent = view === 'pick' ? (
    <TrizPickView
      improving={improving}
      worsening={worsening}
      search={search}
      filteredParams={filteredParams}
      onImprovingChange={handleImprovingChange}
      onWorseningChange={handleWorseningChange}
      onSearchChange={setSearch}
    />
  ) : view === 'matrix' ? (
    <TrizMatrixView
      matrixSearch={matrixSearch}
      onMatrixSearchChange={setMatrixSearch}
      improving={improving}
      worsening={worsening}
      onSelectCell={handleSelectCell}
    />
  ) : (
    <TrizResultsView
      improving={improving}
      worsening={worsening}
      suggestedPrinciples={suggestedPrinciples}
      copied={copied}
      onCopy={handleCopy}
      onReset={handleReset}
      onChangeParams={() => { setView('pick') }}
    />
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10 lg:py-8">
      <TrizHeader
        view={view}
        onViewChange={setView}
        resultsCount={suggestedPrinciples.length}
        hasSelection={improving !== null || worsening !== null}
        onReset={handleReset}
      />
      {viewContent}
    </div>
  )
}
