'use client'

import * as React from 'react'

const SCREEN_READER_DELAY_MS = 50

const AnnouncerContext = React.createContext<((msg: string) => void) | null>(null)

export function Announcer({ children }: { children?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)

  const announce = React.useCallback((msg: string) => {
    if (!ref.current) return
    ref.current.textContent = ''
    setTimeout(() => {
      if (ref.current) {
        ref.current.textContent = msg
      }
    }, SCREEN_READER_DELAY_MS)
  }, [])

  return (
    <AnnouncerContext.Provider value={announce}>
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {children}
    </AnnouncerContext.Provider>
  )
}

export function useAnnouncer(): (msg: string) => void {
  const announce = React.useContext(AnnouncerContext)
  if (!announce) {
    throw new Error('useAnnouncer must be used within an <Announcer /> provider')
  }
  return announce
}
