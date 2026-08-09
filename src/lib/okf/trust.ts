import type { z } from 'zod'
import type { OkfConceptFrontmatterSchema } from './types'

type Frontmatter = z.infer<typeof OkfConceptFrontmatterSchema>

/** §5.3 trust tiers — derived, never stored. */
export function trustTier(
  verified: Frontmatter['verified'],
): 'unverified' | 'machine-confirmed' | 'human-reviewed' {
  if (!verified) {
    return 'unverified'
  }
  const list = Array.isArray(verified) ? verified : [verified]
  if (list.length === 0) {
    return 'unverified'
  }
  if (list.some((v) => v.by.startsWith('human:'))) {
    return 'human-reviewed'
  }
  return 'machine-confirmed'
}

/** §5.5: stale when today >= stale_after (plain date comparison). */
export const isStale = (staleAfter?: string, today = new Date()): boolean => {
  if (!staleAfter) {
    return false
  }
  return today.toISOString().slice(0, 10) >= staleAfter
}
