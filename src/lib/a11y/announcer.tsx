'use client'

import * as React from 'react'

const SCREEN_READER_DELAY_MS = 50

const AnnouncerContext = React.createContext<((msg: string) => void) | null>(null)

/** No-op stand-in used when no `<Announcer />` provider is mounted. */
const noopAnnounce = (): void => undefined

/** Provider that exposes a screen-reader live-region for non-visual announcements. */
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

/**
 * Returns a function that announces a message to screen readers.
 *
 * Degrades to a no-op when no `<Announcer />` provider is mounted rather than
 * throwing: announcement is a progressive enhancement, and a missing live
 * region must never take down the action it was describing. The root layout
 * mounts the provider for the real app.
 */
export function useAnnouncer(): (msg: string) => void {
  return React.useContext(AnnouncerContext) ?? noopAnnounce
}
