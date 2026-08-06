'use client'

import { useState, useEffect } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Returns `true` when the user has enabled "reduce motion" in their OS
 * accessibility settings. Listens for live changes so toggling the setting
 * immediately disables/enables animations.
 */
export function useReducedMotion(): boolean {
  // Read the media query synchronously on first render so animated components
  // never start a motion run before the effect fires (which would freeze them
  // mid-fade and trip axe color-contrast under reduced motion). SSR keeps the
  // non-reduced default; the client first render corrects immediately.
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia(QUERY)
    setReduced(mql.matches)

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}
