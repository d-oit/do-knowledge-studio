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
 * unknown and which carry no createdAt are skipped.
 *
 * Pure and deterministic — unit-tested in timeline-view.test.tsx.
 */
export const buildTimelineGroups = (entities: Entity[], claims: Claim[]): TimelineGroup[] => {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))

  const items: TimelineItem[] = entities.map((entity) => ({
    kind: 'entity',
    id: entity.id,
    label: entity.name,
    date: new Date(entity.createdAt),
    entityType: entity.type,
  }))

  for (const claim of claims) {
    const createdAt = claim.createdAt ?? entityById.get(claim.entityId)?.createdAt
    if (!createdAt) continue
    items.push({
      kind: 'claim',
      id: claim.id,
      label: claim.statement,
      date: new Date(createdAt),
      entityId: claim.entityId,
    })
  }

  items.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || a.label.localeCompare(b.label),
  )

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