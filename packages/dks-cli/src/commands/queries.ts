/**
 * Corpus query commands: search / entity / claims / aliases / relations /
 * index. All read through `dks-core` retrieval + the loaded bundle; results
 * are plain JSON payloads rendered per output format.
 */

import { pwaSearch, type BundleClaim, type LoadedBundle, type SearchResult, type TrustTier } from 'dks-core'
import { bundleClaims, bundleEntities, conceptById, conceptNameById } from '../bundle.js'

export interface SearchData {
  query: string
  limit: number
  results: SearchResult[]
}

export interface RelatedEntry {
  id: string
  /** Display name, or null when the target id is not in the bundle. */
  name: string | null
}

export interface EntityData {
  id: string
  name: string
  type: string
  description: string
  tags: string[]
  aliases: string[]
  trustTier: TrustTier
  claims: BundleClaim[]
  related: RelatedEntry[]
}

export interface ClaimsData {
  id: string
  claims: BundleClaim[]
}

export interface AliasesData {
  id: string
  aliases: string[]
}

export interface RelationsData {
  id: string
  related: RelatedEntry[]
}

export interface IndexEntry {
  id: string
  name: string
}

export interface IndexData {
  total: number
  shown: number
  items: IndexEntry[]
}

/** BM25 search over entities + claims, capped at `limit`. */
export const searchData = (bundle: LoadedBundle, query: string, limit: number): SearchData => ({
  query,
  limit,
  results: pwaSearch(bundleEntities(bundle), bundleClaims(bundle), query, limit),
})

const relatedEntries = (bundle: LoadedBundle, ids: readonly string[]): RelatedEntry[] => {
  const nameById = conceptNameById(bundle)
  return ids.map((id) => ({ id, name: nameById.get(id) ?? null }))
}

/** One entity with its claims and relation targets, or not-found. */
export const entityData = (bundle: LoadedBundle, id: string): EntityData => {
  const concept = conceptById(bundle, id)
  return {
    id: concept.id,
    name: concept.name,
    type: concept.type,
    description: concept.description,
    tags: concept.tags,
    aliases: concept.aliases ?? [],
    trustTier: concept.trustTier,
    claims: concept.claims,
    related: relatedEntries(bundle, concept.relatedIds),
  }
}

/** The entity's claims, or not-found. */
export const claimsData = (bundle: LoadedBundle, id: string): ClaimsData => ({
  id,
  claims: conceptById(bundle, id).claims,
})

/** The entity's aliases (possibly empty), or not-found. */
export const aliasesData = (bundle: LoadedBundle, id: string): AliasesData => ({
  id,
  aliases: conceptById(bundle, id).aliases ?? [],
})

/** The entity's relation targets with resolved names, or not-found. */
export const relationsData = (bundle: LoadedBundle, id: string): RelationsData => ({
  id,
  related: relatedEntries(bundle, conceptById(bundle, id).relatedIds),
})

/** Bundle entity listing (bundle order), first `limit` rows. */
export const indexData = (bundle: LoadedBundle, limit: number): IndexData => ({
  total: bundle.concepts.length,
  shown: Math.min(bundle.concepts.length, limit),
  items: bundle.concepts.slice(0, limit).map((concept) => ({ id: concept.id, name: concept.name })),
})
