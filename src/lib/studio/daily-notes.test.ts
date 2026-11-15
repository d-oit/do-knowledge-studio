import { describe, it, expect } from 'vitest'
import {
  dailyNoteId,
  dailyNoteDayString,
  EntityTemplateSchema,
  daysUntilReview,
  isReviewDue,
} from './daily-notes'

describe('dailyNoteId', () => {
  it('returns the same id twice on the same day', () => {
    const date = new Date('2026-11-15T10:00:00Z')
    expect(dailyNoteId(date, 'UTC')).toBe(dailyNoteId(new Date('2026-11-15T22:00:00Z'), 'UTC'))
  })

  it('differs across time zones at the same instant', () => {
    const instant = new Date('2026-11-15T00:30:00Z')
    const tokyo = dailyNoteDayString(instant, 'Asia/Tokyo')
    const la = dailyNoteDayString(instant, 'America/Los_Angeles')
    expect(tokyo).not.toBe(la)
  })
})

describe('EntityTemplateSchema', () => {
  it('validates a template', () => {
    const result = EntityTemplateSchema.safeParse({
      id: 't1',
      name: 'Meeting',
      body: '# Notes',
      tags: ['meeting'],
      claimStubs: ['Decided X'],
      createdAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })
})

describe('review schedule', () => {
  it('flags unverified, low-confidence, conflicting, and disputed claims due', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z')
    const base = { confidence: 0.9, consecutiveVerifications: 3, lastReviewedAt: null, updatedAt: '2026-11-14T00:00:00.000Z', hasConflict: false } as const
    expect(isReviewDue({ ...base, verification: 'unverified' }, now)).toBe(true)
    expect(isReviewDue({ ...base, verification: 'verified', confidence: 0.2 }, now)).toBe(true)
    expect(isReviewDue({ ...base, verification: 'verified', hasConflict: true }, now)).toBe(true)
    expect(isReviewDue({ ...base, verification: 'disputed' }, now)).toBe(true)
  })

  it('schedules expanding intervals for verified claims', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z')
    const fresh = { verification: 'verified', confidence: 0.9, consecutiveVerifications: 0, lastReviewedAt: '2026-11-14T12:00:00.000Z', updatedAt: '2026-11-14T12:00:00.000Z', hasConflict: false } as const
    expect(daysUntilReview(fresh, now)).toBe(1)
    expect(isReviewDue(fresh, now)).toBe(false)
  })
})
