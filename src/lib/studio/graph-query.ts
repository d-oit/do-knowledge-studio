/**
 * Pure graph queries: canvas filtering and shortest-path search (#1058).
 *
 * Kept free of React, storage, and layout so the graph view, the AI tool
 * registry (`src/lib/ai/tools.ts`), and the offline MCP bridge can all ask the
 * same structural questions of one corpus and get the same answers.
 */
import type { Claim, Entity } from './types'
import type { GraphQuery, GraphQueryClause, GraphQueryCondition } from './graph-query-builder'
import { isGraphQueryEmpty } from './graph-query-builder'
import {
  findShortestPath,
  pathEdgeKeys,
  pathNodeNames,
  undirectedEdgeKey,
  type GraphPathResult,
} from 'dks-core/graph-path'
export { findShortestPath, pathEdgeKeys, pathNodeNames, undirectedEdgeKey }
export type { GraphPathResult }
/** A connection as drawn on the canvas, oriented from its source entity. */
export interface GraphQueryEdge {
  id: string
  source: string
  target: string
  relation: string
}

/** A node in a recovered path, with the display name resolved by the caller. */
export interface GraphPathHop {
  from: string
  to: string
  relation: string
}

/** Filter applied before layout and rendering. Every field defaults inactive. */
export interface GraphFilter {
  /** Entity type ids to keep; empty keeps all types. */
  types: string[]
  /** Tag names to keep (any match); empty keeps all tags. */
  tags: string[]
  /** Relation names to keep on edges; empty keeps all relations. */
  relations: string[]
  /** Keep only entities that carry at least one verified claim. */
  verifiedOnly: boolean
  /** Keep only entities with a claim at or above this confidence (0..1). */
  minConfidence: number
  /** Inclusive ISO date (YYYY-MM-DD) lower bound on `updatedAt`, or null. */
  updatedAfter: string | null
  /** Inclusive ISO date (YYYY-MM-DD) upper bound on `updatedAt`, or null. */
  updatedBefore: string | null
}

/** Inactive filter: every facet permits everything. */
export const EMPTY_GRAPH_FILTER: GraphFilter = {
  types: [],
  tags: [],
  relations: [],
  verifiedOnly: false,
  minConfidence: 0,
  updatedAfter: null,
  updatedBefore: null,
}

/** Confidence at or above which a claim counts as supporting evidence. */
const MIN_SUPPORTING_CONFIDENCE = 0

/** Day-granularity prefix of an ISO timestamp, used for date-range compare. */
const DAY_PREFIX_LENGTH = 10

/** Result of applying a filter to the corpus. */
export interface FilteredGraph {
  /** Entities that survived every facet. */
  entities: Entity[]
  /** Claims visible for the surviving entities. */
  claims: Claim[]
  /** Edges between surviving entities, after the relation facet. */
  edges: GraphQueryEdge[]
}

/** True when any facet of the filter narrows the graph. */
export const isGraphFilterActive = (filter: GraphFilter): boolean =>
  filter.types.length > 0 ||
  filter.tags.length > 0 ||
  filter.relations.length > 0 ||
  filter.verifiedOnly ||
  filter.minConfidence > MIN_SUPPORTING_CONFIDENCE ||
  filter.updatedAfter !== null ||
  filter.updatedBefore !== null

/** Number of facets currently narrowing the graph (drives the toolbar badge). */
export const countActiveFilterFacets = (filter: GraphFilter): number => {
  let count = 0
  if (filter.types.length > 0) count += 1
  if (filter.tags.length > 0) count += 1
  if (filter.relations.length > 0) count += 1
  if (filter.verifiedOnly) count += 1
  if (filter.minConfidence > MIN_SUPPORTING_CONFIDENCE) count += 1
  if (filter.updatedAfter !== null || filter.updatedBefore !== null) count += 1
  return count
}

/** Canonical key for a connection, independent of traversal direction. */


/** Day prefix of an entity timestamp, or '' when it is not a valid ISO date. */
const dayOf = (timestamp: string): string => timestamp.slice(0, DAY_PREFIX_LENGTH)

/** Whether a claim satisfies the verification facets of a filter. */
const claimQualifies = (claim: Claim, filter: GraphFilter): boolean =>
  (!filter.verifiedOnly || claim.verification === 'verified') &&
  claim.confidence >= filter.minConfidence

/**
 * Applies a filter to entities, claims, and the connections between them.
 *
 * A verified-only or confidence filter keeps an entity only while it has at
 * least one qualifying claim, and returns just those claims. Edges come from
 * `entity.links` (relation types), not from claims, so no edge is invented or
 * dropped by claim verification — the relation facet is what narrows edges.
 */
export const filterGraph = (
  entities: Entity[],
  claims: Claim[],
  filter: GraphFilter,
): FilteredGraph => {
  const claimsByEntity = new Map<string, Claim[]>()
  for (const claim of claims) {
    const bucket = claimsByEntity.get(claim.entityId)
    if (bucket) bucket.push(claim)
    else claimsByEntity.set(claim.entityId, [claim])
  }

  const keepsEntity = (entity: Entity): boolean => {
    if (filter.types.length > 0 && !filter.types.includes(entity.type)) return false
    if (filter.tags.length > 0 && !entity.tags.some((tag) => filter.tags.includes(tag))) {
      return false
    }
    if (filter.updatedAfter !== null && dayOf(entity.updatedAt) < filter.updatedAfter) {
      return false
    }
    if (filter.updatedBefore !== null && dayOf(entity.updatedAt) > filter.updatedBefore) {
      return false
    }
    if (!filter.verifiedOnly && filter.minConfidence <= MIN_SUPPORTING_CONFIDENCE) return true
    const entityClaims = claimsByEntity.get(entity.id) ?? []
    return entityClaims.some((claim) => claimQualifies(claim, filter))
  }

  const keptEntities = entities.filter(keepsEntity)
  const keptIds = new Set(keptEntities.map((entity) => entity.id))

  const visibleClaims = claims.filter(
    (claim) => keptIds.has(claim.entityId) && claimQualifies(claim, filter),
  )

  const edges: GraphQueryEdge[] = []
  for (const entity of keptEntities) {
    for (const link of entity.links) {
      if (!keptIds.has(link.targetId)) continue
      if (filter.relations.length > 0 && !filter.relations.includes(link.relation)) continue
      edges.push({
        id: `${entity.id}->${link.targetId}`,
        source: entity.id,
        target: link.targetId,
        relation: link.relation,
      })
    }
  }

  return { entities: keptEntities, claims: visibleClaims, edges }
}
/**
 * Applies a composed query (#1164) to the corpus with exactly the same
 * entity/claim/edge semantics as {@link filterGraph}: the builder preview and
 * the canvas render through this one path, so their counts cannot drift.
 *
 * The query must be valid (see `validateGraphQuery`). An empty root matches
 * everything; an invalid query's behavior is undefined, so callers must not
 * apply one.
 */
export const evaluateGraphQuery = (
  entities: Entity[],
  claims: Claim[],
  query: GraphQuery,
): FilteredGraph => {
  if (isGraphQueryEmpty(query)) return filterGraph(entities, claims, EMPTY_GRAPH_FILTER)

  const claimsByEntity = new Map<string, Claim[]>()
  for (const claim of claims) {
    const bucket = claimsByEntity.get(claim.entityId)
    if (bucket) bucket.push(claim)
    else claimsByEntity.set(claim.entityId, [claim])
  }

  const matchCondition = (entity: Entity, condition: GraphQueryCondition): boolean => {
    switch (condition.kind) {
      case 'entityType':
        return entity.type === condition.value
      case 'tag':
        return entity.tags.includes(condition.value)
      case 'text': {
        const needle = condition.value.toLowerCase()
        return (
          entity.name.toLowerCase().includes(needle) ||
          entity.description.toLowerCase().includes(needle) ||
          entity.content.toLowerCase().includes(needle)
        )
      }
      case 'claimStatus':
        return (claimsByEntity.get(entity.id) ?? []).some(
          (claim) => claim.verification === condition.value,
        )
      case 'minConfidence':
        return (claimsByEntity.get(entity.id) ?? []).some(
          (claim) => claim.confidence >= condition.value,
        )
    }
  }

  // A group matches when its operator combines its children. An empty non-root
  // group matches nothing (fail-closed, never silently broadening); the empty
  // root matches everything, which was handled above. Exclude negates a
  // clause inside its group.
  const matchClause = (entity: Entity, clause: GraphQueryClause): boolean => {
    const matches =
      'children' in clause
        ? clause.children.length === 0
          ? false
          : clause.op === 'and'
            ? clause.children.every((child) => matchClause(entity, child))
            : clause.children.some((child) => matchClause(entity, child))
        : matchCondition(entity, clause)
    return clause.exclude ? !matches : matches
  }

  const keptEntities = entities.filter((entity) => matchClause(entity, query))
  const keptIds = new Set(keptEntities.map((entity) => entity.id))

  const visibleClaims = claims.filter((claim) => keptIds.has(claim.entityId))

  const edges: GraphQueryEdge[] = []
  for (const entity of keptEntities) {
    for (const link of entity.links) {
      if (!keptIds.has(link.targetId)) continue
      edges.push({
        id: `${entity.id}->${link.targetId}`,
        source: entity.id,
        target: link.targetId,
        relation: link.relation,
      })
    }
  }

  return { entities: keptEntities, claims: visibleClaims, edges }
}


/** Shortest-path and path helpers come from the shared `dks-core` engine. */
