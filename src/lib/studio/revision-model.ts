/**
 * Durable entity revision model (#1060).
 *
 * Undo/redo snapshots the whole corpus in memory and dies with the tab; a
 * reload or a bad sync merge leaves no way back to an earlier note. This module
 * is the pure half of the feature: the record schema, the throttle that keeps
 * typing from minting a revision per keystroke, and the retention plan that
 * bounds both the count per entity and the bytes it may use. Storage lives in
 * `revision-storage.ts`, and the capture policy that couples the two lives in
 * `revision-capture.ts`.
 */
import { z } from 'zod'
import { EntitySchema } from './schema'
import type { Entity } from './types'

/** Why a revision was captured. */
export const REVISION_REASONS = ['save', 'merge', 'import', 'restore'] as const

/** Union of the revision reasons. */
export type RevisionReason = (typeof REVISION_REASONS)[number]

/** One stored snapshot of a single entity. */
export const EntityRevisionSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  /** ISO timestamp of the capture. */
  createdAt: z.string(),
  reason: z.enum(REVISION_REASONS),
  /** Optional human label, e.g. the peer a merge came from. */
  label: z.string().optional(),
  /** Serialized size of `entity`, used to enforce the byte budget. */
  bytes: z.number().int().nonnegative(),
  entity: EntitySchema,
})

/** A stored entity revision. */
export type EntityRevision = z.infer<typeof EntityRevisionSchema>

/** Minimum gap between two `save` revisions of the same entity. */
export const REVISION_THROTTLE_MS = 5 * 60_000

/** How many of the newest revisions an entity keeps regardless of age. */
export const MAX_REVISIONS_PER_ENTITY = 20

/** How many distinct days keep a milestone revision beyond the newest K. */
export const MAX_DAILY_MILESTONES = 14

/** Total bytes every entity's revisions may occupy. */
export const MAX_REVISION_BYTES = 4 * 1024 * 1024


/**
 * Fields that make two snapshots the same version of an entity. Deliberately
 * excludes `updatedAt`: a save that only bumps the timestamp is not a version
 * worth keeping, and capturing it would fill the throttle window with noise.
 */
export const entitySnapshotSignature = (entity: Entity): string =>
  JSON.stringify([
    entity.name,
    entity.type,
    entity.description,
    entity.content,
    entity.sourceUrl ?? '',
    entity.tags,
    entity.links,
  ])

/** Whether `next` is a different version of the entity from `previous`. */
export const hasEntityChanged = (previous: Entity | null | undefined, next: Entity): boolean =>
  previous === null || previous === undefined
    ? true
    : entitySnapshotSignature(previous) !== entitySnapshotSignature(next)

/** Approximate serialized size of an entity snapshot, in bytes. */
export const revisionBytes = (entity: Entity): number => JSON.stringify(entity).length

/** The UTC day bucket a revision belongs to. */
const dayKey = (iso: string): string => iso.slice(0, 10)

/** Newest first, with the id as a stable tie-break for identical timestamps. */
const newestFirst = (a: EntityRevision, b: EntityRevision): number => {
  const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
}

/**
 * Whether a capture is warranted.
 *
 * Only `save` is throttled: a merge, import, or restore is a discrete event the
 * user will want to find later, so it is always kept (when the content actually
 * differs). `save` is kept when the content changed AND either the entity has no
 * revision yet or the throttle window has elapsed.
 */
export const shouldCaptureRevision = (input: {
  previous?: Entity | null
  next: Entity
  reason: RevisionReason
  now: number
  lastCapturedAt?: number
}): boolean => {
  if (!hasEntityChanged(input.previous, input.next)) return false
  if (input.reason !== 'save') return true
  if (input.lastCapturedAt === undefined) return true
  return input.now - input.lastCapturedAt >= REVISION_THROTTLE_MS
}

/**
 * Ids to delete so one entity's revisions stay inside the retention policy.
 *
 * Keeps the newest `MAX_REVISIONS_PER_ENTITY` revisions plus one milestone per
 * day (the newest of each day, at most `MAX_DAILY_MILESTONES` days), then drops
 * the oldest survivors until the kept set fits `MAX_REVISION_BYTES`. Eviction is
 * oldest-first, so the most recent history is what survives a budget squeeze.
 */
export const planEvictions = (revisions: readonly EntityRevision[]): string[] => {
  const sorted = [...revisions].sort(newestFirst)
  const keep = new Set(sorted.slice(0, MAX_REVISIONS_PER_ENTITY).map((revision) => revision.id))

  const milestoneDays = new Set<string>()
  for (const revision of sorted.slice(MAX_REVISIONS_PER_ENTITY)) {
    if (milestoneDays.size >= MAX_DAILY_MILESTONES) break
    const day = dayKey(revision.createdAt)
    if (milestoneDays.has(day)) continue
    milestoneDays.add(day)
    keep.add(revision.id)
  }

  const kept = sorted.filter((revision) => keep.has(revision.id))
  let bytes = kept.reduce((total, revision) => total + revision.bytes, 0)
  // Oldest first: `kept` is newest-first, so walk from the end until it fits.
  for (let index = kept.length - 1; index >= 0 && bytes > MAX_REVISION_BYTES; index -= 1) {
    const revision = kept[index]
    if (revision === undefined) break
    bytes -= revision.bytes
    keep.delete(revision.id)
  }

  return sorted.filter((revision) => !keep.has(revision.id)).map((revision) => revision.id)
}

/** Count and byte total of a revision set, for the panel's usage line. */
export const summarizeRevisionUsage = (
  revisions: readonly EntityRevision[],
): { count: number; bytes: number } => ({
  count: revisions.length,
  bytes: revisions.reduce((total, revision) => total + revision.bytes, 0),
})
