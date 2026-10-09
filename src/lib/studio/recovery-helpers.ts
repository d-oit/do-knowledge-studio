import { z } from 'zod'
import type { Entity, Claim } from './types'
import {
  EntitySchema,
  ClaimSchema,
  GraphSchema,
  MindMapSchema,
  LinkSchema,
  TagSchema,
} from './schema'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import { useStudioStore } from './store'
import { reconcileSnapshot, type HistorySnapshot } from './history-snapshot'
import { isSyncBlocked } from './hydration-guard'

/** localStorage key for the recovery snapshot. */
const RECOVERY_KEY = 'do-knowledge-studio-recovery'
/** Time-to-live for recovery snapshots (24 hours). */
const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000
/** Maximum serialized size in bytes for a recovery snapshot (4 MB). */
const MAX_RECOVERY_SIZE_BYTES = 4 * 1024 * 1024

export interface RecoverySnapshot {
  entities: Entity[]
  claims: Claim[]
  entityHistory: HistorySnapshot[]
  historyIndex: number
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Creates a deep-cloned recovery snapshot from the current store state. */
export const buildRecoverySnapshot = (state: {
  entities: Entity[]
  claims: Claim[]
  entityHistory: HistorySnapshot[]
  historyIndex: number
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}): RecoverySnapshot => ({
  entities: structuredClone(state.entities),
  claims: structuredClone(state.claims),
  entityHistory: structuredClone(state.entityHistory),
  historyIndex: state.historyIndex,
  graph: state.graph ? structuredClone(state.graph) : undefined,
  mindMap: state.mindMap ? structuredClone(state.mindMap) : undefined,
  links: state.links ? structuredClone(state.links) : undefined,
  tags: state.tags ? structuredClone(state.tags) : undefined,
})


/* ------------------------------------------------------------------------- *
 * Availability signal
 *
 * The snapshot is written by `persistRecoverySnapshot`, which runs inside a
 * store action — long after the shell mounted. A banner that only reads the
 * snapshot on mount therefore never learns that a backup just became
 * available, which is precisely the moment it matters. Subscribers are
 * notified on write and on consume so the offer appears immediately after an
 * import and disappears the moment it is taken.
 *
 * Declared above its callers: these are `const` arrows, so they are in the
 * temporal dead zone until evaluated.
 * ------------------------------------------------------------------------- */

const availabilitySubscribers = new Set<() => void>()

/** Notifies every subscriber that the restorable-snapshot state may have changed. */
const notifyAvailability = (): void => {
  for (const subscriber of availabilitySubscribers) subscriber()
}

/**
 * Subscribes to changes in whether a restorable snapshot exists.
 *
 * Returns an unsubscribe function. Intentionally holds no store import, so
 * `store.ts` and `slices/*` can call the notifier without an import cycle.
 */
export const subscribeToRecoveryAvailability = (listener: () => void): (() => void) => {
  availabilitySubscribers.add(listener)
  return () => { availabilitySubscribers.delete(listener) }
}
/** Why a recovery snapshot could not be written. */
export type RecoveryPersistFailure = 'too-large' | 'storage-unavailable'

/**
 * Outcome of persisting a pre-import recovery snapshot.
 *
 * `persisted: false` is a real outcome, not an internal detail: the caller is
 * about to destroy the corpus the snapshot was meant to protect, so it must be
 * able to tell the user that no safety net exists rather than reporting a clean
 * import.
 */
export type RecoveryPersistResult =
  | { persisted: true }
  | { persisted: false; reason: RecoveryPersistFailure }

/**
 * Persists a recovery snapshot to localStorage with size and TTL guards.
 *
 * Returns whether the write actually happened. A skipped or refused write is
 * reported, never silently swallowed.
 *
 * The two failure modes are deliberately NOT treated alike:
 *
 * - `too-large`: the write was refused by *our* size guard while storage is
   healthy. Any snapshot still present describes a corpus the user replaced one
   import ago, so it is cleared — leaving it would let a later restore hand back
   stale data as if it were current.
 * - `storage-unavailable`: storage itself is refusing writes (quota, blocked
   site data). `localStorage.removeItem` still succeeds in that state, so
   clearing here would **destroy the previous snapshot** — the only copy of the
   corpus that is about to be replaced. It is left untouched: a stale-but-real
   backup beats no backup, and the banner never claims otherwise because the
   snapshot it describes is checked against the schema and TTL on every read.
 *
 * `console.warn` stays because these paths are hard to reach from a UI test.
 */
export const persistRecoverySnapshot = (snapshot: RecoverySnapshot): RecoveryPersistResult => {
  let serialized: string
  try {
    serialized = JSON.stringify({ snapshot, timestamp: Date.now(), ttl: RECOVERY_TTL_MS })
  } catch {
    // An unserializable snapshot (circular state) is our bug, not storage's.
    console.warn('Failed to serialize recovery snapshot')
    return { persisted: false, reason: 'too-large' }
  }

  if (serialized.length > MAX_RECOVERY_SIZE_BYTES) {
    console.warn('Recovery snapshot exceeds size limit, skipping persistence')
    clearRecoverySnapshot()
    return { persisted: false, reason: 'too-large' }
  }

  try {
    localStorage.setItem(RECOVERY_KEY, serialized)
    notifyAvailability()
    return { persisted: true }
  } catch {
    console.warn('Failed to persist recovery snapshot')
    // Deliberately does NOT clear: see the note above.
    return { persisted: false, reason: 'storage-unavailable' }
  }
}

/** Zod schema for validating persisted recovery snapshot structure. */
const RecoverySnapshotSchema = z.object({
  snapshot: z.object({
    entities: z.array(EntitySchema),
    claims: z.array(ClaimSchema),
    entityHistory: z.array(
      z.object({
        entities: z.array(EntitySchema),
        claims: z.array(ClaimSchema),
      }),
    ),
    historyIndex: z.number(),
    graph: GraphSchema.optional(),
    mindMap: MindMapSchema.optional(),
    links: z.array(LinkSchema).optional(),
    tags: z.array(TagSchema).optional(),
  }),
  timestamp: z.number(),
  ttl: z.number().optional(),
})

/** Result type for reading a recovery snapshot from localStorage. */
type RecoveryReadResult =
  | { ok: true; data: z.infer<typeof RecoverySnapshotSchema> }
  | { ok: false; error: string }

/** Removes the recovery snapshot from localStorage. */
const clearRecoverySnapshot = (): void => {
  try {
    localStorage.removeItem(RECOVERY_KEY)
    notifyAvailability()
  } catch {
    console.warn('Failed to clear corrupt recovery snapshot')
  }
}

/**
 * Reads and validates the recovery snapshot from localStorage, returning it if
 * valid.
 *
 * Never throws. The two ways it can fail are kept apart on purpose, because
 * only one of them justifies destroying the stored bytes:
 *
 * - storage unreadable (blocked site data, `SecurityError`): the snapshot is
 *   not known to be bad, so it is left alone and the real cause is surfaced.
 * - bytes present but unparseable or schema-invalid: genuinely useless, so it
 *   is cleared rather than left to fail every future attempt.
 */
export const readRecoverySnapshot = (): RecoveryReadResult => {
  let raw: string | null
  try {
    raw = localStorage.getItem(RECOVERY_KEY)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Recovery snapshot storage is unavailable.',
    }
  }
  if (!raw) return { ok: false, error: 'No recovery snapshot found.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearRecoverySnapshot()
    return { ok: false, error: 'Recovery snapshot is corrupted.' }
  }

  const result = RecoverySnapshotSchema.safeParse(parsed)
  if (!result.success) {
    clearRecoverySnapshot()
    return { ok: false, error: 'Recovery snapshot is corrupted.' }
  }

  const { timestamp, ttl } = result.data
  if (Date.now() - timestamp > (ttl ?? RECOVERY_TTL_MS)) {
    clearRecoverySnapshot()
    return { ok: false, error: 'Recovery snapshot has expired.' }
  }
  return { ok: true, data: result.data }
}

/** Validated snapshot shape extracted from the Zod schema. */
type ValidatedRecoverySnapshot = Omit<
  z.infer<typeof RecoverySnapshotSchema>['snapshot'],
  'entityHistory'
> & { entityHistory: HistorySnapshot[] }

/** Applies a validated recovery snapshot to the Zustand store. */
const applyRecoverySnapshot = (snapshot: ValidatedRecoverySnapshot): void => {
  // A recovered history stack can reference entities that predate a later
  // prune; reconcile each step so undo can never reintroduce an orphan.
  const entityHistory = snapshot.entityHistory.map(reconcileSnapshot)
  useStudioStore.setState({
    entities: reconcileSnapshot({
      entities: snapshot.entities as Entity[],
      claims: snapshot.claims as Claim[],
    }).entities,
    claims: snapshot.claims as Claim[],
    entityHistory,
    historyIndex: Math.min(snapshot.historyIndex, entityHistory.length - 1),
    graph: snapshot.graph as ValidatedGraph | undefined,
    mindMap: snapshot.mindMap as ValidatedMindMap | undefined,
    links: snapshot.links as ValidatedLink[] | undefined,
    tags: snapshot.tags as ValidatedTag[] | undefined,
  })
}

/**
 * Restores store state from the recovery snapshot and clears it afterward.
 *
 * Clearing is the point of no return: the snapshot is the only copy of the
 * corpus the import replaced. So it happens ONLY after the restore is known to
 * have landed, and never on a failure path — a user who is told the restore
 * failed must still be able to retry.
 */
export const restoreFromRecovery = (): { success: boolean; error?: string } => {
  // A refused hydration latches the persist writer off for the rest of the page
  // session (ADR 028), so the swap below would be dropped on the way to storage
  // while `clearRecoverySnapshot` deleted the only copy — the user would be told
  // the library came back, then lose it on reload. Refuse instead. The UI also
  // hides the offer in this state; this guard covers any other caller.
  if (isSyncBlocked()) {
    return {
      success: false,
      error: 'This workspace is not saving, so the backup cannot be restored safely. Reload first.',
    }
  }

  // `readRecoverySnapshot` never throws: it distinguishes unreadable storage
  // (do not clear) from unusable bytes (already cleared), and reports both.
  const result = readRecoverySnapshot()
  if (!result.ok) return { success: false, error: result.error }

  try {
    applyRecoverySnapshot(result.data.snapshot)
  } catch (err) {
    // Applying swaps the corpus in memory and then persists it, so this can
    // throw on a full quota with the store already changed. Do NOT clear: the
    // backup is the only way back, and a retry has to stay possible.
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to apply the recovery snapshot.',
    }
  }

  clearRecoverySnapshot()
  return { success: true }
}

/** Human-readable summary of a restorable pre-import snapshot. */
export type RecoverySnapshotSummary = {
  entityCount: number
  claimCount: number
}

/**
 * Describes the pre-import snapshot without applying it.
 *
 * Used by the restore banner to decide whether it has anything to offer. It
 * shares `readRecoverySnapshot` so an expired or corrupt snapshot is discarded
 * exactly as it would be on a real restore — otherwise the banner would
 * advertise a backup that the restore path would then refuse.
 */
export const describeRecoverySnapshot = (): RecoverySnapshotSummary | null => {
  // `readRecoverySnapshot` is contractually non-throwing, which matters here:
  // this runs from an effect in the app shell, where a throw would take the
  // whole workspace down over an unrelated leftover backup. The contract is
  // pinned by a test rather than a redundant try/catch.
  const result = readRecoverySnapshot()
  if (!result.ok) return null
  return {
    entityCount: result.data.snapshot.entities.length,
    claimCount: result.data.snapshot.claims.length,
  }
}

