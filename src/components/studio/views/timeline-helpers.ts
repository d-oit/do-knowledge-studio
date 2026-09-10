import { isSameDay, isSameMonth, startOfDay, startOfMonth } from 'date-fns'
import type { AnyEntityType, Claim, Entity } from '@/lib/studio/types'

/** A single marker on the timeline: an entity or a claim. */
export interface TimelineItem {
  kind: 'entity' | 'claim'
  id: string
  label: string
  /** The date this marker sits on (claim createdAt, falling back to entity createdAt). */
  date: Date
  /** Owner entity id — present for claims, used to open the owning entity. */
  entityId?: string
  /** Entity type — present for entity markers, used to render the type icon/badge. */
  entityType?: AnyEntityType
}

/** One day band within a month band, containing its markers (newest first). */
export interface TimelineDay {
  /** Start of the local calendar day. */
  day: Date
  items: TimelineItem[]
}

/** One month band on the timeline, containing day bands (newest first). */
export interface TimelineGroup {
  /** Start of the local calendar month. */
  month: Date
  days: TimelineDay[]
}

/**
 * Groups entities (by createdAt) and claims (by their own createdAt, falling
 * back to the owning entity's createdAt) into month bands containing day
 * bands. Bands and items are ordered newest first. Claims whose entity is
 * unknown and which carry no createdAt are skipped. Items with unparsable
 * timestamps are skipped too (persisted claims allow any string).
 *
 * Pure and deterministic — unit-tested in timeline-view.test.tsx.
 */

/** Builds a Date or null when the raw timestamp string is unparsable. */
const parseTimestamp = (raw: string | undefined | null): Date | null => {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Collects entity markers (skipping unparsable created timestamps). */
const collectEntityItems = (entities: Entity[]): TimelineItem[] => {
  const items: TimelineItem[] = []
  for (const entity of entities) {
    const date = parseTimestamp(entity.createdAt)
    if (date === null) continue
    items.push({
      kind: 'entity',
      id: entity.id,
      label: entity.name,
      date,
      entityType: entity.type,
    })
  }
  return items
}

/**
 * Collects claim markers. The date is the claim's own createdAt, falling back
 * to the owning entity's createdAt; claims with neither are skipped.
 */
const collectClaimItems = (claims: Claim[], entityById: Map<string, Entity>): TimelineItem[] => {
  const items: TimelineItem[] = []
  for (const claim of claims) {
    const createdAt = claim.createdAt ?? entityById.get(claim.entityId)?.createdAt
    if (!createdAt) continue
    const date = parseTimestamp(createdAt)
    if (date === null) continue
    items.push({
      kind: 'claim',
      id: claim.id,
      label: claim.statement,
      date,
      entityId: claim.entityId,
    })
  }
  return items
}

/** Buckets sorted items into month bands containing day bands (newest first). */
const bucketTimelineItems = (items: TimelineItem[]): TimelineGroup[] => {
  const groups: TimelineGroup[] = []
  let currentMonth: TimelineGroup | undefined
  let currentDay: TimelineDay | undefined

  for (const item of items) {
    if (!currentMonth || !isSameMonth(item.date, currentMonth.month)) {
      currentMonth = { month: startOfMonth(item.date), days: [] }
      groups.push(currentMonth)
      currentDay = undefined
    }
    if (!currentDay || !isSameDay(item.date, currentDay.day)) {
      currentDay = { day: startOfDay(item.date), items: [] }
      currentMonth.days.push(currentDay)
    }
    currentDay.items.push(item)
  }

  return groups
}

export const buildTimelineGroups = (entities: Entity[], claims: Claim[]): TimelineGroup[] => {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))

  const items = [
    ...collectEntityItems(entities),
    ...collectClaimItems(claims, entityById),
  ]

  items.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || a.label.localeCompare(b.label),
  )

  return bucketTimelineItems(items)
}