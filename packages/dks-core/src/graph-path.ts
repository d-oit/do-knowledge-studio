/**
 * Undirected graph traversal — the PWA's shortest-path semantics,
 * single-sourced here.
 *
 * This module is a framework-neutral port of the path portion of
 * `src/lib/studio/graph-query.ts` (`findShortestPath`, `pathNodeNames`,
 * `pathEdgeKeys`, `undirectedEdgeKey`, adjacency builder). The PWA file
 * re-exports these from here; the `dks` CLI and MCP adapter call the same
 * functions. Connections are treated as undirected (the way the studio
 * canvas draws them), and paths are deterministic: neighbor buckets are
 * sorted by display name.
 */

/** Minimal structural shape of a graph entity (PWA `Entity` satisfies it). */
export interface PwaGraphEntityLike {
  id: string
  name: string
  links?: ReadonlyArray<{ targetId: string; relation?: string }>
}

/** A connection as drawn on the canvas, oriented from its source entity. */
export interface PathEdge {
  id: string
  source: string
  target: string
  relation: string
}

/** A node in a recovered path, with the display name resolved by the caller. */
export interface PathHop {
  from: string
  to: string
  relation: string
}

/** Outcome of a path query: the shortest route, or why there is none. */
export type GraphPathResult =
  | { found: true; nodeIds: string[]; edges: PathHop[] }
  | { found: false; reason: 'unknown-entity' | 'no-path' }

/** Canonical key for a connection, independent of traversal direction. */
export const undirectedEdgeKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

/** The endpoint of an edge other than `id`. */
const otherEnd = (edge: PathEdge, id: string): string =>
  edge.source === id ? edge.target : edge.source

/** Builds undirected adjacency, sorted by the neighbour's display name. */
export const buildUndirectedAdjacency = (
  entities: PwaGraphEntityLike[],
): Map<string, PathEdge[]> => {
  const nameOf = new Map(entities.map((entity) => [entity.id, entity.name]))
  const adjacency = new Map<string, PathEdge[]>()
  const add = (id: string, edge: PathEdge): void => {
    const bucket = adjacency.get(id)
    if (bucket) bucket.push(edge)
    else adjacency.set(id, [edge])
  }
  for (const entity of entities) {
    for (const link of entity.links ?? []) {
      const edge: PathEdge = {
        id: `${entity.id}->${link.targetId}`,
        source: entity.id,
        target: link.targetId,
        relation: link.relation ?? '',
      }
      add(entity.id, edge)
      add(link.targetId, edge)
    }
  }
  const compare = (a: PathEdge, b: PathEdge, id: string): number =>
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
 * reports `no-path` instead of an empty list.
 */
export const findShortestPath = (
  entities: PwaGraphEntityLike[],
  fromId: string,
  toId: string,
): GraphPathResult => {
  const known = new Set(entities.map((entity) => entity.id))
  if (!known.has(fromId) || !known.has(toId)) return { found: false, reason: 'unknown-entity' }
  if (fromId === toId) return { found: true, nodeIds: [fromId], edges: [] }

  const adjacency = buildUndirectedAdjacency(entities)
  const cameFrom = new Map<string, PathEdge>()
  const visited = new Set<string>([fromId])
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
  const edges: PathHop[] = []
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
export const pathNodeNames = (entities: PwaGraphEntityLike[], nodeIds: string[]): string[] => {
  const nameOf = new Map(entities.map((entity) => [entity.id, entity.name]))
  return nodeIds.flatMap((id) => {
    const name = nameOf.get(id)
    return name === undefined ? [] : [name]
  })
}

/** Canonical undirected keys for the connections along a path. */
export const pathEdgeKeys = (edges: PathHop[]): Set<string> =>
  new Set(edges.map((edge) => undirectedEdgeKey(edge.from, edge.to)))
