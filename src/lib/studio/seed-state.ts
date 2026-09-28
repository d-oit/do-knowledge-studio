/**
 * Canonical seed state for the studio store (Plan 157 Phase 3).
 *
 * Kept here so the store initializer, `resetStore`, and the import-rollback
 * fallback all reference one definition instead of three copies that can
 * drift. Values are cloned on every application so a mutation can never write
 * through to the module-level seed arrays (Plan 131 D1.25).
 */
import { seedEntities, seedClaims, seedChat } from './seed-data'
import type { ViewId, AnyEntityType } from './types'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import type { StudioState } from './store-types'

/**
 * The subset of {@link StudioState} the seed data defines. Every key here is
 * supplied by `buildSeedState`; actions are composed separately.
 */
export type SeedState = Pick<
  StudioState,
  | 'entities'
  | 'claims'
  | 'chat'
  | 'chatLoading'
  | 'currentView'
  | 'searchQuery'
  | 'typeFilter'
  | 'semanticSearchEnabled'
  | 'sortBy'
  | 'sortDir'
  | 'rightPanelOpen'
  | 'graph'
  | 'mindMap'
  | 'links'
  | 'tags'
>

/**
 * The seed values, held by reference. Read-only here: consumers must go
 * through {@link buildSeedState} to get a mutable copy.
 */
const SEED_VALUES = {
  entities: seedEntities,
  claims: seedClaims,
  chat: seedChat,
  chatLoading: false,
  currentView: 'home' as ViewId,
  searchQuery: '',
  typeFilter: 'all' as AnyEntityType | 'all',
  semanticSearchEnabled: false,
  sortBy: 'updated' as 'name' | 'created' | 'updated',
  sortDir: 'desc' as 'asc' | 'desc',
  rightPanelOpen: true,
  graph: undefined as ValidatedGraph | undefined,
  mindMap: undefined as ValidatedMindMap | undefined,
  links: undefined as ValidatedLink[] | undefined,
  tags: undefined as ValidatedTag[] | undefined,
}

/** Builds a fresh, independent copy of the seed state. */
export const buildSeedState = (): SeedState => ({
  ...SEED_VALUES,
  entities: structuredClone(seedEntities),
  claims: structuredClone(seedClaims),
  chat: structuredClone(seedChat),
})

/** The immutable seed baseline, for read-only comparisons in tests. */
export const SEED_STATE: Readonly<SeedState> = SEED_VALUES
