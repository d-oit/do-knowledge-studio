/**
 * Persistence hydration pipeline (ADR 028 §4).
 *
 * Every byte entering the store from localStorage passes through
 * {@link mergeHydratedState}, which validates the payload against the Zod
 * envelope schema regardless of whether the persist middleware invoked a
 * migration. Corrupt payloads are discarded in favor of the current
 * (seed) state — raw input is never allowed into the store, and undo
 * history is rebased onto the freshly hydrated corpus so the first edit
 * after a reload cannot revert user data to demo seeds.
 *
 * @see plans/ADRs/028-validated-recoverable-local-data-boundaries.md
 * @see plans/131-goap-swarm-improvement-audit-2026-08-22.md (G1)
 */

import type { Claim, Entity, ChatMessage, ViewId, EntityType } from './types'
import { validatePersistedState } from './schema'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations'

/** localStorage key holding the studio persistence envelope. */
export const STUDIO_STORAGE_KEY = 'do-knowledge-studio-store'

/** Durable state keys written to localStorage; everything else is session-scoped. */
export const PERSISTED_KEYS = [
  'entities',
  'claims',
  'chat',
  'currentView',
  'typeFilter',
  'sortBy',
  'sortDir',
  'rightPanelOpen',
  'graph',
  'mindMap',
  'links',
  'tags',
] as const

/** Structural subset of StudioState that is persisted across sessions. */
interface PersistedSlice {
  entities: Entity[]
  claims: Claim[]
  chat: ChatMessage[]
  currentView: ViewId
  typeFilter: EntityType | 'all'
  sortBy: 'name' | 'created' | 'updated'
  sortDir: 'asc' | 'desc'
  rightPanelOpen: boolean
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Fields the hydration merger must understand to keep undo coherent. */
interface HistoryFields {
  entityHistory: Entity[][]
  historyIndex: number
}

/** Any state shape the hydration functions can operate on. */
type HydratableState = PersistedSlice & HistoryFields

/** Verdict returned when inspecting an incoming persistence payload. */
export interface SanitizeVerdict {
  ok: boolean
  data: Partial<PersistedSlice>
  reason?: string
}

/**
 * Raised when a persisted payload must not enter the store. Throwing aborts
 * the persist middleware's hydration chain *before* its post-migration
 * `setItem`, so rejected envelopes stay on disk untouched and recoverable
 * instead of being overwritten by seed state.
 */
export class HydrationRejectedError extends Error {
  constructor(reason: string) {
    super(`Persisted state rejected: ${reason}`)
    this.name = 'HydrationRejectedError'
  }
}

/** Shallow-clones entities so snapshots share no mutable references. */
const cloneEntities = (entities: Entity[]): Entity[] => entities.map((e) => ({ ...e }))

/**
 * Validates an incoming payload from localStorage against the envelope schema.
 *
 * Returns `ok: true` with the parsed slice when every record is trustworthy;
 * otherwise explains why the payload must be dropped. Never throws.
 */
export const sanitizeHydration = (persisted: unknown): SanitizeVerdict => {
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
    return { ok: false, data: {}, reason: 'payload is not an object' }
  }
  const result = validatePersistedState(persisted)
  if (result.success) {
    // The envelope's bookkeeping version is middleware metadata, not state.
    const { version: _envelopeVersion, ...slice } = result.data
    return { ok: true, data: slice }
  }
  const first = result.errors[0]
  return {
    ok: false,
    data: {},
    reason: first ? `${first.path || '(root)'}: ${first.message}` : 'schema mismatch',
  }
}

/**
 * Runs versioned migrations using the envelope version supplied by the
 * persist middleware. On failure returns an empty marker instead of raw
 * input — {@link mergeHydratedState} discards anything failing validation,
 * so the marker never reaches runtime state and the historical leak of
 * unvalidated payloads past migration is closed without depending on
 * middleware throw semantics.
 */
/**
 * Runs versioned migrations using the envelope version supplied by the
 * persist middleware.
 *
 * Throws {@link HydrationRejectedError} when migrations fail or the payload
 * is newer than this build supports — the middleware's catch path then skips
 * both the state swap and its post-migration rewrite, preserving the user's
 * envelope on disk for recovery (ADR 028 §4).
 */
export const migratePersistedState = (persistedState: unknown, version: number): PersistedSlice => {
  // runMigrations operates on a deliberately loose legacy shape (older
  // envelopes predate the strict slice types). mergeHydratedState validates
  // the result against the Zod envelope before anything reaches runtime
  // state, so this boundary assertion cannot smuggle bad data through.
  const migrated = runMigrations(persistedState, version)
  if (!migrated) {
    throw new HydrationRejectedError(
      `no safe migration from version ${version}; payload preserved on disk`,
    )
  }
  return migrated as PersistedSlice
}

/**
 * Picks the durable keys from live state. Ephemeral high-frequency fields
 * (search query, selection, palette flags) stay out of localStorage so
 * typing never serializes the whole corpus.
 */
export const partializePersistedState = (state: PersistedSlice): Partial<PersistedSlice> => ({
  entities: state.entities,
  claims: state.claims,
  chat: state.chat,
  currentView: state.currentView,
  typeFilter: state.typeFilter,
  sortBy: state.sortBy,
  sortDir: state.sortDir,
  rightPanelOpen: state.rightPanelOpen,
  graph: state.graph,
  mindMap: state.mindMap,
  links: state.links,
  tags: state.tags,
})

/**
 * Single enforcement point for every hydration path (same-version reloads
 * included — zustand only calls `migrate` on version mismatches).
 *
 * Valid payloads replace matching fields and rebase the undo baseline onto
 * the hydrated corpus. Anything else raises {@link HydrationRejectedError}
 * so the middleware aborts before swapping state or rewriting storage —
 * raw input is never merged, and the payload remains available for recovery.
 */
export const mergeHydratedState = <S extends HydratableState>(persisted: unknown, current: S): S => {
  const verdict = sanitizeHydration(persisted)
  if (!verdict.ok) {
    throw new HydrationRejectedError(verdict.reason ?? 'invalid payload')
  }
  const merged: S = { ...current, ...verdict.data }
  // The first edit after a reload must undo back to the loaded corpus,
  // never to the in-memory seed snapshot that initialized history.
  return {
    ...merged,
    entityHistory: [cloneEntities(merged.entities)],
    historyIndex: 0,
  }
}

/** Current envelope version, re-exported for the persist options wiring. */
export { CURRENT_SCHEMA_VERSION }
