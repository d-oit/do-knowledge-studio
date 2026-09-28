'use client'

/**
 * Composition root for the studio store (Plan 157 Phase 3).
 *
 * The store's *shape* lives in `store-types.ts` and each concern lives in
 * `./slices/*`, so this module only wires the persist middleware and exports
 * the derived read hooks. Slices receive `StateCreator<StudioState>` and
 * compose through the same `set`/`get` pair, so cross-slice calls (a claim
 * write pushing history) still work without an import cycle.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { search } from '@/lib/search/retrieval'
import type { Entity, Claim } from './types'
import {
  CURRENT_SCHEMA_VERSION,
  STUDIO_STORAGE_KEY,
  hydrateWithOutcome,
  migratePersistedState,
  partializePersistedState,
} from './hydration'
import { quarantinePayload } from './hydration-quarantine'
import { buildSeedState } from './seed-state'
import type { StudioState } from './store-types'
import { createEntitiesSlice } from './slices/entities-slice'
import { createClaimsSlice } from './slices/claims-slice'
import { createHistorySlice } from './slices/history-slice'
import { createChatSlice } from './slices/chat-slice'
import { createDataSlice } from './slices/data-slice'
import { createUiSlice } from './slices/ui-slice'
import { snapshotCorpus } from './history-snapshot'

export { restoreFromRecovery } from './recovery-helpers'
export { readQuarantine, clearQuarantine, describeQuarantine } from './hydration-quarantine'
export type { StudioState, ImportOptions } from './store-types'

/** Why the last hydration attempt refused, or null when it succeeded. */
let lastRejectionReason: string | null = null

/**
 * Reads the stored envelope verbatim so it can be preserved in quarantine.
 * The persist `merge` callback receives already-deserialized data, so the
 * original bytes have to be fetched separately.
 */
const readRawEnvelope = (): string | null => {
  try {
    return localStorage.getItem(STUDIO_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to read the stored envelope:', error)
    return null
  }
}

/** Initial state: seed corpus plus a matching single-entry undo baseline. */
const buildInitialState = () => {
  const seed = buildSeedState()
  return {
    ...seed,
    entityHistory: [snapshotCorpus(seed.entities, seed.claims)],
    historyIndex: 0,
  }
}

/** Primary Zustand store for the knowledge studio with persistence and undo/redo. */
export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),
      ...createUiSlice(set, get),
      ...createEntitiesSlice(set, get),
      ...createClaimsSlice(set, get),
      ...createHistorySlice(set, get),
      ...createChatSlice(set, get),
      ...createDataSlice(set, get),
    }),
    {
      name: STUDIO_STORAGE_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Hydration pipeline lives in ./hydration — validation runs on EVERY
      // load (not just version mismatches), corrupt payloads are discarded
      // in favor of current state, and undo history is rebased onto the
      // hydrated corpus. Ephemeral fields (searchQuery, selection, palette)
      // stay out of localStorage so keystrokes never serialize the corpus.
      partialize: partializePersistedState,
      // Both hooks report a refusal through a return value rather than a
      // throw. A throw inside this promise chain lands in zustand's terminal
      // catch, which skips the branch that sets `hasHydrated` — the store
      // would then never finish hydrating and the user would see a silently
      // broken app with no idea their data is at risk. Plan 158 P0-3.
      // `migrate` must return the BARE migrated state: zustand passes that
      // value straight into `merge`, so returning a wrapper object here would
      // hand `merge` a shape the envelope schema rejects.
      //
      // On refusal, return the input UNCHANGED and quarantine the bytes
      // separately. zustand treats any non-Promise return as "migrated" and
      // calls setItem(), so echoing the input is what keeps the stored
      // envelope byte-identical instead of replacing it with seed data.
      migrate: (persisted: unknown, version: number): unknown => {
        const outcome = migratePersistedState(persisted, version)
        if (!outcome.ok) {
          lastRejectionReason = outcome.reason
          quarantinePayload(outcome.reason, readRawEnvelope())
          return persisted
        }
        return outcome.state
      },
      // Contextual wrapper pins zustand's store generic — the bare generic
      // helper leaks its type parameter into persist's inference.
      merge: (persistedState: unknown, currentState: StudioState) => {
        // `migrate` refuses (future version, no safe path) by returning the
        // input unchanged. Accepting it would hydrate a payload written by a
        // newer build, so treat any refusal as fatal for this attempt and
        // keep the store on seed data. The bytes are already quarantined by
        // the migrate hook; the next write can no longer reach them.
        if (lastRejectionReason !== null) {
          const reason = lastRejectionReason
          lastRejectionReason = null
          console.warn(`Studio hydration refused: ${reason}`)
          return currentState
        }
        const outcome = hydrateWithOutcome(persistedState, currentState)
        if (!outcome.ok) {
          // Reachable without any version delta: same-version reloads skip
          // `migrate` entirely, so validation is the only gate.
          quarantinePayload(outcome.reason, readRawEnvelope())
          return currentState
        }
        return outcome.state
      },
      // The documented channel for reporting a hydration problem, so a
      // refused payload is visible rather than a silent downgrade to demo data.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('Studio hydration failed:', error)
        }
      },
    },
  ),
)

/** Minimum result capacity for BM25-ranked Library queries (covers the full corpus). */
const MIN_SEARCH_CAPACITY = 100

/** Deduplicated entities from BM25 results, retaining relevance order. */
// skipcq: JS-R1005 -- BM25 ranking helper complexity is intentional and covered by tests
const rankEntitiesByQuery = (entities: Entity[], claims: Claim[], query: string): Entity[] => {
  const results = search(
    entities,
    claims,
    query,
    Math.max(entities.length + claims.length, MIN_SEARCH_CAPACITY),
  )
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
  const matched: Entity[] = []
  const seen = new Set<string>()
  for (const result of results) {
    const entityId = result.type === 'entity' ? result.id : result.entityId
    if (entityId === undefined || seen.has(entityId)) {
      continue
    }
    seen.add(entityId)
    const entity = entityMap.get(entityId)
    if (entity) {
      matched.push(entity)
    }
  }
  return matched
}

/** Sorts entities by the active sort criteria ('updated' is the default field). */
const sortEntitiesBy = (
  entities: Entity[],
  sortBy: 'name' | 'created' | 'updated',
  sortDir: 'asc' | 'desc',
): Entity[] =>
  [...entities].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'created') cmp = a.createdAt.localeCompare(b.createdAt)
    else cmp = a.updatedAt.localeCompare(b.updatedAt)
    return sortDir === 'asc' ? cmp : -cmp
  })

/** Returns entities filtered by type and search query. When a search query is active,
 * results are ranked by BM25 relevance score (reversed if sortDir is 'asc'); otherwise,
 * entities are sorted by the active sort criteria (sortBy/sortDir).
 * Uses BM25 retrieval across entities and claims when a search query is present, unifying
 * relevance semantics with Chat/AI and right-panel ranked mode. */
export const useFilteredEntities = (): Entity[] => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const typeFilter = useStudioStore((s) => s.typeFilter)
  const sortBy = useStudioStore((s) => s.sortBy)
  const sortDir = useStudioStore((s) => s.sortDir)

  return useMemo(() => {
    const query = searchQuery.trim()
    let list = query === '' ? entities : rankEntitiesByQuery(entities, claims, query)

    if (typeFilter !== 'all') {
      list = list.filter((entity) => entity.type === typeFilter)
    }

    // No search query: apply the selected sort field and direction.
    // Active query: preserve BM25 relevance order (reversed for 'asc').
    if (query === '') {
      return sortEntitiesBy(list, sortBy, sortDir)
    }
    return sortDir === 'asc' ? [...list].reverse() : list
  }, [entities, claims, searchQuery, typeFilter, sortBy, sortDir])
}

/** Computes library statistics: entity counts by type, claim totals, and recent items. */
export const useStats = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)

  return useMemo(() => {
    const byType = entities.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    const verified = claims.filter((c) => c.verification === 'verified').length
    const recent = [...entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    return {
      total: entities.length,
      claims: claims.length,
      verified,
      byType,
      recent,
    }
  }, [entities, claims])
}

// Auto-start cross-tab store coordination when running in browser environments.
// The dynamic import keeps the store<->cross-tab module graph acyclic: cross-tab.ts
// reads this store at module scope, so a static import here would re-enter this
// module mid-evaluation and let cross-tab's module-scoped bindings stay in the
// temporal dead zone whenever cross-tab is the entry module. Deferring with a
// promise also guarantees every module body has evaluated before listeners attach.
if (typeof window !== 'undefined') {
  // skipcq: JS-0098 -- void is required for Codacy no-floating-promises on fire-and-forget import
  void import('./cross-tab')
    .then(({ initCrossTabSync }) => initCrossTabSync())
    .catch((error: unknown) => {
      console.error('Failed to start cross-tab store coordination:', error)
    })
}
