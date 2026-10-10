'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * The answer used while rendering on the server **and** while hydrating.
 *
 * It must never consult `matchMedia`. The server cannot know the media state, so
 * a client read during the hydration pass renders different markup than the HTML
 * that was sent for every element whose props derive from this hook
 * (`initial={reducedMotion ? false : {...}}`, ~25 call sites). React then reports
 * a hydration mismatch and re-renders the subtree on load — for exactly the
 * users who asked for less motion (plans/161).
 *
 * `useSyncExternalStore` re-reads the client value as soon as hydration
 * finishes, so the correction still lands ahead of the effect-driven motion
 * problem the old synchronous read existed to prevent.
 */
const getServerSnapshot = (): boolean => false

/**
 * Client answer. Module scope on purpose: `useSyncExternalStore` needs these
 * callbacks to keep a stable identity across renders, or it re-subscribes on
 * every one.
 */
const getSnapshot = (): boolean => window.matchMedia(QUERY).matches

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQuery = window.matchMedia(QUERY)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

/**
 * Returns `true` when the user has enabled "reduce motion" in their OS
 * accessibility settings. Listens for live changes so toggling the setting
 * immediately disables/enables animations.
 *
 * Hydration-safe: the first client render matches the server, and the real
 * preference applies immediately afterwards.
 */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
