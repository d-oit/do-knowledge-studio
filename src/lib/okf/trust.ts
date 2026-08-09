import type { z } from 'zod'
import type { OkfConceptFrontmatterSchema } from './types'

/** Parsed OKF concept frontmatter shape consumed by the trust helpers. */
type Frontmatter = z.infer<typeof OkfConceptFrontmatterSchema>

/**
 * Classifies a frontmatter `verified` value into a trust tier (§5.3, derived).
 * @param verified - The raw verified value (single entry or list).
 * @param today - Reference date used to classify process-generated entries.
 * @returns The trust tier: 'human-reviewed', 'fresh', or 'stale'.
 */
export const trustTier = (
  verified?: Frontmatter['verified'],
): 'unverified' | 'machine-confirmed' | 'human-reviewed' => {
  if (!verified) {
    return 'unverified'
  }
  /** The list. */
  const list = Array.isArray(verified) ? verified : [verified]
  if (list.length === 0) {
    return 'unverified'
  }
  if (list.some((v) => v.by.startsWith('human:'))) {
    return 'human-reviewed'
  }
  return 'machine-confirmed'
}

/**
 * §5.5: stale when today >= stale_after (plain date comparison).
 * @param staleAfter - ISO date after which the concept is stale.
 * @param today - Reference date (defaults to now).
 * @returns True when today's date is at or past stale_after.
 */
export const isStale = (staleAfter?: string, today = new Date()): boolean => {
  if (!staleAfter) {
    return false
  }
  return today.toISOString().slice(0, 10) >= staleAfter
}