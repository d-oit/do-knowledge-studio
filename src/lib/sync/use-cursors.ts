'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  onCursorChange,
  setCursorPosition,
  clearCursorPosition,
  setSelection,
  clearSelection,
  type RemoteCursor,
} from './cursors'

export type { RemoteCursor }

export interface UseCursorsReturn {
  cursors: RemoteCursor[]
  cursorsInView: RemoteCursor[]
  setCursor: (x: number, y: number) => void
  clearCursor: () => void
  select: (start: number, end: number, text: string) => void
  clearSelect: () => void
}

export function useCursors(view?: string): UseCursorsReturn {
  const [cursors, setCursors] = useState<RemoteCursor[]>([])
  const [cursorsInView, setCursorsInView] = useState<RemoteCursor[]>([])

  useEffect(() => {
    const unsub = onCursorChange((remoteCursors) => {
      setCursors(remoteCursors)
      if (view) {
        setCursorsInView(remoteCursors.filter((c) => c.currentView === view))
      }
    })

    return unsub
  }, [view])

  const setCursor = useCallback((x: number, y: number) => {
    setCursorPosition(x, y)
  }, [])

  const clearCursor = useCallback(() => {
    clearCursorPosition()
  }, [])

  const select = useCallback((start: number, end: number, text: string) => {
    setSelection(start, end, text)
  }, [])

  const clearSelect = useCallback(() => {
    clearSelection()
  }, [])

  return {
    cursors,
    cursorsInView,
    setCursor,
    clearCursor,
    select,
    clearSelect,
  }
}
