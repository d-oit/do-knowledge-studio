/**
 * Daily notes, entity templates, and claim review queue (#1138).
 *
 * All scheduling is pure and timezone-safe: callers inject the clock (and
 * timeZone for the daily-note title). No network, no AI.
 */
import { z } from 'zod'

/** Interval (days) between claim reviews per consecutive verification. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const

/** Claims untouched for this long become due even when verified. */
export const REVIEW_STALE_AFTER_DAYS = 30

/** Longest accepted template name. */
export const TEMPLATE_NAME_MAX_LENGTH = 80

/** Zod schema for a user-defined entity template. */
export const EntityTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(TEMPLATE_NAME_MAX_LENGTH),
  body: z.string().max(50_000),
  tags: z.array(z.string().max(80)).max(50),
  claimStubs: z.array(z.string().max(500)).max(20),
  createdAt: z.string().min(1),
})

/** A user-defined entity template. */
export type EntityTemplate = z.infer<typeof EntityTemplateSchema>

/** Stable daily-note identity for a calendar day in a time zone. */
export const dailyNoteId = (date: Date, timeZone?: string): string => {
  const day = dailyNoteDayString(date, timeZone)
  return `daily-${day}`
}

/** YYYY-MM-DD calendar-day string in the given time zone (or UTC). */
export const dailyNoteDayString = (date: Date, timeZone?: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Human title for the daily note (shared Intl formatter, locale-sensitive). */
export const dailyNoteTitle = (date: Date, timeZone?: string): string => {
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(date)
  return `Daily note — ${formatted}`
}

/** Review state for one claim. */
export interface ClaimReviewState {
  verification: 'unverified' | 'verified' | 'disputed'
  confidence: number
  consecutiveVerifications: number
  lastReviewedAt: string | null
  updatedAt: string
  hasConflict: boolean
}

/** Days until the next review for a claim state (0 = due now). */
export const daysUntilReview = (claim: ClaimReviewState, now: number = Date.now()): number => {
  if (claim.hasConflict || claim.verification === 'disputed') return 0
  if (claim.verification === 'unverified' || claim.confidence < 0.5) return 0
  const anchor = claim.lastReviewedAt ?? claim.updatedAt
  const anchorMs = Date.parse(anchor)
  if (Number.isNaN(anchorMs)) return 0
  const interval = REVIEW_INTERVALS_DAYS[Math.min(claim.consecutiveVerifications, REVIEW_INTERVALS_DAYS.length - 1)] ?? REVIEW_STALE_AFTER_DAYS
  const dueMs = anchorMs + interval * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((dueMs - now) / (24 * 60 * 60 * 1000)))
}

/** True when the claim is due for review now. */
export const isReviewDue = (claim: ClaimReviewState, now: number = Date.now()): boolean =>
  daysUntilReview(claim, now) <= 0
