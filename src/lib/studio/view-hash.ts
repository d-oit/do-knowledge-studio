import { VIEW_IDS, type ViewId } from './types'

/** Returns the canonical hash route for a navigable view. */
export const viewToHash = (view: ViewId): string => `#/${view}`

/** Parses a view hash; empty hashes and skip-link anchors are not view routes. */
export const parseViewHash = (hash: string): ViewId | null => {
  const route = hash.startsWith('#') ? hash.slice(1) : hash
  if (!route.startsWith('/')) return null

  const candidate = route.slice(1)
  return VIEW_IDS.find((view) => view === candidate) ?? 'home'
}

/** Whether the hash names one of the canonical view routes. */
export const isKnownViewHash = (hash: string): boolean => {
  const route = hash.startsWith('#') ? hash.slice(1) : hash
  if (!route.startsWith('/')) return false

  const candidate = route.slice(1)
  return VIEW_IDS.some((view) => view === candidate)
}
