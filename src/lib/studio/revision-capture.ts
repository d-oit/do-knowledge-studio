/**
 * Capturing entity revisions from the write path (#1060).
 *
 * The live save path must never fail because history failed: quota errors,
 * blocked transactions, and malformed records are logged and dropped here, and
 * every function in this module resolves instead of rejecting. Capture is also
 * throttled per entity (see `shouldCaptureRevision`), so typing and autosave
 * cannot mint a revision per keystroke.
 */
import { logger } from '@/lib/logging/logger'
import type { Entity } from './types'
import {
  MAX_REVISION_BYTES,
  EntityRevisionSchema,
  planEvictions,
  revisionBytes,
  shouldCaptureRevision,
  type EntityRevision,
  type RevisionReason,
} from './revision-model'
import {
  appendEntityRevision,
  deleteRevisions,
  listEntityRevisions,
  listRevisionSummaries,
} from './revision-storage'

const log = logger.child({ area: 'store' })

/** Last capture time per entity id, in epoch milliseconds. */
const lastCaptureAt = new Map<string, number>()

/** Clears throttle state (tests). */
export const resetRevisionCaptureForTests = (): void => {
  lastCaptureAt.clear()
}

/** What to capture, and which version it is being compared against. */
export interface CaptureRevisionInput {
  /** Snapshot to store. */
  entity: Entity
  /** Version currently in the corpus, when there is one. */
  previous?: Entity | null
  reason: RevisionReason
  /** Capture clock, injectable for tests. */
  now?: number
}

/** Whether `captureEntityRevision` would store anything for this input. */
export const shouldCaptureNow = (input: CaptureRevisionInput): boolean =>
  shouldCaptureRevision({
    previous: input.previous,
    next: input.entity,
    reason: input.reason,
    now: input.now ?? Date.now(),
    lastCapturedAt: lastCaptureAt.get(input.entity.id),
  })

/** Builds the stored record for one capture. */
const buildRevision = (input: CaptureRevisionInput, now: number): EntityRevision =>
  EntityRevisionSchema.parse({
    id: crypto.randomUUID(),
    entityId: input.entity.id,
    createdAt: new Date(now).toISOString(),
    reason: input.reason,
    bytes: revisionBytes(input.entity),
    entity: structuredClone(input.entity),
  })

/** Drops the oldest revisions until one entity fits its retention plan. */
const enforceEntityRetention = async (entityId: string): Promise<void> => {
  const revisions = await listEntityRevisions(entityId)
  const evicted = planEvictions(revisions)
  if (evicted.length > 0) await deleteRevisions(evicted)
}

/** Drops the oldest revisions until the whole store fits the byte budget. */
const enforceGlobalBudget = async (): Promise<void> => {
  const summaries = await listRevisionSummaries()
  let bytes = summaries.reduce((total, summary) => total + summary.bytes, 0)
  if (bytes <= MAX_REVISION_BYTES) return
  const doomed: string[] = []
  // `listRevisionSummaries` is oldest first, so this evicts oldest first.
  for (const summary of summaries) {
    if (bytes <= MAX_REVISION_BYTES) break
    doomed.push(summary.id)
    bytes -= summary.bytes
  }
  if (doomed.length > 0) await deleteRevisions(doomed)
}

/**
 * Stores a revision when the policy allows it. Never rejects: a history write
 * that fails must not surface as a save failure.
 * @returns Whether a revision was written.
 */
export const captureEntityRevision = async (
  input: CaptureRevisionInput,
): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') return false
  if (!shouldCaptureNow(input)) return false
  const now = input.now ?? Date.now()
  try {
    await appendEntityRevision(buildRevision(input, now))
    lastCaptureAt.set(input.entity.id, now)
    await enforceEntityRetention(input.entity.id)
    await enforceGlobalBudget()
    return true
  } catch (error) {
    log.warn('Entity revision was not stored; the save itself is unaffected', { error })
    return false
  }
}

/**
 * Fire-and-forget capture for synchronous store actions. The promise is
 * observed so a future change that lets it reject is still reported.
 */
export const recordEntityRevision = (input: CaptureRevisionInput): void => {
  void captureEntityRevision(input).catch((error: unknown) => {
    log.warn('Entity revision capture failed unexpectedly', { error })
  })
}
