/**
 * Pure graph queries: canvas filtering and shortest-path search (#1058).
 *
 * Kept free of React, storage, and layout so the graph view, the AI tool
 * registry (`src/lib/ai/tools.ts`), and the offline MCP bridge can all ask the
 * same structural questions of one corpus and get the same answers.
 */
import type { Claim, Entity } from './types'

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
export const undirectedEdgeKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

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

/** Outcome of a path query: the shortest route, or why there is none. */
export type GraphPathResult =
  | { found: true; nodeIds: string[]; edges: GraphPathHop[] }
  | { found: false; reason: 'unknown-entity' | 'no-path' }

/** The endpoint of an edge other than `id`. */
const otherEnd = (edge: GraphQueryEdge, id: string): string =>
  edge.source === id ? edge.target : edge.source

/**
 * Builds undirected adjacency, sorted by the neighbour's display name so a
 * query over the same corpus always returns the same path.
 */
const buildQueryAdjacency = (entities: Entity[]): Map<string, GraphQueryEdge[]> => {
  const nameOf = new Map(entities.map((entity) => [entity.id, entity.name]))
  const adjacency = new Map<string, GraphQueryEdge[]>()
  const add = (id: string, edge: GraphQueryEdge): void => {
    const bucket = adjacency.get(id)
    if (bucket) bucket.push(edge)
    else adjacency.set(id, [edge])
  }
  for (const entity of entities) {
    for (const link of entity.links) {
      const edge: GraphQueryEdge = {
        id: `${entity.id}->${link.targetId}`,
        source: entity.id,
        target: link.targetId,
        relation: link.relation,
      }
      add(entity.id, edge)
      add(link.targetId, edge)
    }
  }
  const compare = (a: GraphQueryEdge, b: GraphQueryEdge, id: string): number =>
    (nameOf.get(otherEnd(a, id)) ?? '').localeCompare(nameOf.get(otherEnd(b, id)) ?? '')
  for (const [id, bucket] of adjacency) {
    bucket.sort((a, b) => compare(a, b, id))
  }
  return adjacency
}

/**
 * Breadth-first shortest path between two entities over `links`, treating
 * connections as undirected (the same way the canvas draws them).
 *
 * Cycles terminate because each node is enqueued once; a disconnected target
 * reports `no-path` instead of an empty list, so callers can say so plainly.
 */
export const findShortestPath = (
  entities: Entity[],
  fromId: string,
  toId: string,
): GraphPathResult => {
  const known = new Set(entities.map((entity) => entity.id))
  if (!known.has(fromId) || !known.has(toId)) return { found: false, reason: 'unknown-entity' }
  if (fromId === toId) return { found: true, nodeIds: [fromId], edges: [] }

  const adjacency = buildQueryAdjacency(entities)
  const cameFrom = new Map<string, GraphQueryEdge>()
  const visited = new Set<string>([fromId])
  // `for…of` over an array it grows is the queue: the iterator visits
  // appended entries, so no index arithmetic (and no unguarded index read).
  const queue: string[] = [fromId]

  for (const current of queue) {
    for (const edge of adjacency.get(current) ?? []) {
      const next = otherEnd(edge, current)
      if (visited.has(next)) continue
      visited.add(next)
      cameFrom.set(next, edge)
      queue.push(next)
    }
  }

  if (!cameFrom.has(toId)) return { found: false, reason: 'no-path' }

  const nodeIds = [toId]
  const edges: GraphPathHop[] = []
  let cursor = toId
  while (cursor !== fromId) {
    const edge = cameFrom.get(cursor)
    if (!edge) return { found: false, reason: 'no-path' }
    const prev = otherEnd(edge, cursor)
    edges.push({ from: prev, to: cursor, relation: edge.relation })
    cursor = prev
    nodeIds.push(cursor)
  }
  edges.reverse()
  nodeIds.reverse()
  return { found: true, nodeIds, edges }
}

/** Display names for path node ids, in path order, skipping unknown ids. */
export const pathNodeNames = (entities: Entity[], nodeIds: string[]): string[] => {
  const nameOf = new Map(entities.map((entity) => [entity.id, entity.name]))
  return nodeIds.flatMap((id) => {
    const name = nameOf.get(id)
    return name === undefined ? [] : [name]
  })
}

/** Canonical undirected keys for the connections along a path. */
export const pathEdgeKeys = (edges: GraphPathHop[]): Set<string> =>
  new Set(edges.map((edge) => undirectedEdgeKey(edge.from, edge.to)))
