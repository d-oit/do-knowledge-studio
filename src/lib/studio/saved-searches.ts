/**
 * Saved searches / smart collections (#1137).
 *
 * A typed, Zod-validated filter model: text query + mode, entity types, tags,
 * claim status/confidence, updated-within, has-conflicts. Serializable so it
 * syncs and exports; counts are computed by callers (debounced, off main
 * thread in the UI).
 */
import { z } from 'zod'
import type { Entity, Claim } from './types'

/** Hard cap on saved collections so the envelope cannot grow without bound. */
export const MAX_SAVED_SEARCHES = 50

/** Longest accepted collection name. */
export const SAVED_SEARCH_NAME_MAX_LENGTH = 60

/** Search modes mirrored from the search engine. */
export const SAVED_SEARCH_MODES = ['lexical', 'semantic', 'hybrid'] as const

/** Zod schema for one saved search collection. */
export const SavedSearchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(SAVED_SEARCH_NAME_MAX_LENGTH),
  query: z.string().max(500),
  mode: z.enum(SAVED_SEARCH_MODES),
  types: z.array(z.string()).max(20),
  tags: z.array(z.string()).max(50),
  claimStatus: z.array(z.enum(['unverified', 'verified', 'disputed'])),
  minConfidence: z.number().min(0).max(1),
  updatedWithinDays: z.number().int().min(0).max(3650),
  hasConflictsOnly: z.boolean(),
  createdAt: z.string().min(1),
})

/** Array schema for the persisted envelope and backup payload. */
export const SavedSearchesSchema = z.array(SavedSearchSchema).max(MAX_SAVED_SEARCHES)

/** A saved, named search collection. */
export type SavedSearch = z.infer<typeof SavedSearchSchema>

/** Everything a caller supplies; id and timestamp are derived. */
export type SavedSearchInput = Omit<SavedSearch, 'id' | 'createdAt'>

/** Default filter: match everything. */
export const EMPTY_SAVED_SEARCH_FILTER: Omit<SavedSearch, 'id' | 'name' | 'createdAt' | 'query'> = {
  mode: 'hybrid',
  types: [],
  tags: [],
  claimStatus: [],
  minConfidence: 0,
  updatedWithinDays: 0,
  hasConflictsOnly: false,
}

/** Normalizes a user-typed collection name: trimmed and length-capped. */
export const normalizeSavedSearchName = (name: string): string =>
  name.trim().slice(0, SAVED_SEARCH_NAME_MAX_LENGTH)

/** Builds a persisted collection from user input with derived id/timestamp. */
export const createSavedSearch = (input: SavedSearchInput): SavedSearch =>
  SavedSearchSchema.parse({
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  })

/** Pure predicate: does an entity match the collection filter (text matched by caller). */
export const entityMatchesSavedSearch = (
  entity: Entity,
  filter: Pick<SavedSearch, 'types' | 'tags' | 'updatedWithinDays'>,
  now: number = Date.now(),
): boolean => {
  if (filter.types.length > 0 && !filter.types.includes(entity.type)) return false
  if (filter.tags.length > 0 && !filter.tags.every((tag) => entity.tags.includes(tag))) return false
  if (filter.updatedWithinDays > 0) {
    const updated = Date.parse(entity.updatedAt)
    if (Number.isNaN(updated)) return false
    const cutoff = now - filter.updatedWithinDays * 24 * 60 * 60 * 1000
    if (updated < cutoff) return false
  }
  return true
}

/** Counts claims of an entity matching the claim half of the filter. */
export const countMatchingClaims = (
  claims: Claim[],
  entityId: string,
  filter: Pick<SavedSearch, 'claimStatus' | 'minConfidence'>,
): number =>
  claims.filter(
    (claim) =>
      claim.entityId === entityId &&
      (filter.claimStatus.length === 0 || filter.claimStatus.includes(claim.verification)) &&
      claim.confidence >= filter.minConfidence,
  ).length
