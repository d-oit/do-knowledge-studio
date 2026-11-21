/**
 * `dks graph` — neighbors / path / stats over the bundle's undirected
 * relation graph. Traversal algorithms are dks-core's (single source);
 * this layer only shapes queries, depths, and envelopes.
 */

import {
  buildUndirectedAdjacency,
  findShortestPath,
  undirectedEdgeKey,
  type LoadedBundle,
  type PathHop,
} from 'dks-core'
import { parseLocalFlags } from '../args.js'
import { conceptById, conceptNameById, graphEntities } from '../bundle.js'
import { CliError } from '../errors.js'

/** `graph neighbors` depth bounds and default (#1171). */
export const DEFAULT_NEIGHBOR_DEPTH = 1
export const MAX_NEIGHBOR_DEPTH = 3
export const MIN_NEIGHBOR_DEPTH = 1

export interface GraphNodeEntry {
  id: string
  name: string
  depth: number
}

export interface GraphEdgeEntry {
  source: string
  target: string
  relation: string
}

export interface GraphNeighborsData {
  root: string
  depth: number
  nodes: GraphNodeEntry[]
  edges: GraphEdgeEntry[]
}

export interface GraphPathNode {
  id: string
  name: string
}

export interface GraphPathData {
  from: string
  to: string
  nodes: GraphPathNode[]
  hops: PathHop[]
}

export interface TypeCount {
  type: string
  count: number
}

export interface GraphStatsData {
  nodes: number
  edges: number
  types: TypeCount[]
  orphans: number
  orphanIds: string[]
}

/** Parses `--depth`; out-of-range or non-integer values are usage errors. */
export const parseDepth = (raw: string): number => {
  const value = Number(raw)
  if (!Number.isInteger(value)) {
    throw new CliError('usage', `--depth expects an integer, got "${raw}"`, `allowed range ${MIN_NEIGHBOR_DEPTH}–${MAX_NEIGHBOR_DEPTH}`)
  }
  if (value < MIN_NEIGHBOR_DEPTH || value > MAX_NEIGHBOR_DEPTH) {
    throw new CliError('usage', `--depth ${value} is out of range`, `allowed range ${MIN_NEIGHBOR_DEPTH}–${MAX_NEIGHBOR_DEPTH}`)
  }
  return value
}

/** BFS neighborhood around `rootId` across relation links, up to `depth`. */
export const neighborsData = (bundle: LoadedBundle, rootId: string, depth: number): GraphNeighborsData => {
  conceptById(bundle, rootId)
  const adjacency = buildUndirectedAdjacency(graphEntities(bundle))
  const nameById = conceptNameById(bundle)

  const depths = new Map<string, number>([[rootId, 0]])
  const nodes: GraphNodeEntry[] = [{ id: rootId, name: nameById.get(rootId) ?? rootId, depth: 0 }]
  const edges: GraphEdgeEntry[] = []
  const seenEdges = new Set<string>()
  const queue: string[] = [rootId]

  for (const current of queue) {
    const currentDepth = depths.get(current) ?? 0
    if (currentDepth >= depth) continue
    for (const edge of adjacency.get(current) ?? []) {
      const next = edge.source === current ? edge.target : edge.source
      if (!depths.has(next)) {
        depths.set(next, currentDepth + 1)
        nodes.push({ id: next, name: nameById.get(next) ?? next, depth: depths.get(next) ?? 0 })
        queue.push(next)
      }
      const key = undirectedEdgeKey(current, next)
      if (!seenEdges.has(key)) {
        seenEdges.add(key)
        // Undirected edges are emitted canonically: source ≤ target
        // (codepoint order), independent of which side declared the link.
        const [source, target] = current <= next ? [current, next] : [next, current]
        edges.push({ source, target, relation: edge.relation })
      }
    }
  }
  return { root: rootId, depth, nodes, edges }
}

/** Shortest undirected path; disconnected endpoints are `path_not_found`. */
export const pathData = (bundle: LoadedBundle, fromId: string, toId: string): GraphPathData => {
  conceptById(bundle, fromId)
  conceptById(bundle, toId)
  const result = findShortestPath(graphEntities(bundle), fromId, toId)
  if (!result.found) {
    throw new CliError(
      'path_not_found',
      `"${fromId}" and "${toId}" are not connected`,
      'graph relations are undirected; connect the components in the bundle to link them',
    )
  }
  const nameById = conceptNameById(bundle)
  return {
    from: fromId,
    to: toId,
    nodes: result.nodeIds.map((id) => ({ id, name: nameById.get(id) ?? id })),
    hops: result.edges,
  }
}

/** Corpus graph shape: node/edge counts, type histogram, orphans. */
export const statsData = (bundle: LoadedBundle): GraphStatsData => {
  const adjacency = buildUndirectedAdjacency(graphEntities(bundle))
  const edgeKeys = new Set<string>()
  for (const bucket of adjacency.values()) {
    for (const edge of bucket) {
      edgeKeys.add(undirectedEdgeKey(edge.source, edge.target))
    }
  }

  const typeCounts = new Map<string, number>()
  for (const concept of bundle.concepts) {
    typeCounts.set(concept.type, (typeCounts.get(concept.type) ?? 0) + 1)
  }
  const types = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => (b.count - a.count) || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))

  const orphanIds = bundle.concepts
    .filter((concept) => (adjacency.get(concept.id)?.length ?? 0) === 0)
    .map((concept) => concept.id)
  return {
    nodes: bundle.concepts.length,
    edges: edgeKeys.size,
    types,
    orphans: orphanIds.length,
    orphanIds,
  }
}

/** `--depth` option of `graph neighbors`. */
const DEPTH_OPTION = '--depth'
const GRAPH_SUBCOMMANDS = 'neighbors | path | stats'

/** Splits graph args into operands plus a validated `--depth` (or default). */
const parseGraphArgs = (args: readonly string[]): { operands: string[]; depth: number } => {
  const { options, operands } = parseLocalFlags(args, [DEPTH_OPTION])
  const rawDepth = options.get(DEPTH_OPTION)
  const depth = rawDepth === undefined ? DEFAULT_NEIGHBOR_DEPTH : parseDepth(rawDepth)
  return { operands, depth }
}

/** Dispatches `dks graph ...` to its subcommand implementation. */
export const graphData = (
  args: readonly string[],
  load: () => LoadedBundle,
): GraphNeighborsData | GraphPathData | GraphStatsData => {
  const { operands, depth } = parseGraphArgs(args)
  const sub = operands.at(0)
  switch (sub) {
    case 'neighbors': {
      const id = operands.at(1)
      if (id === undefined) {
        throw new CliError('usage', 'graph neighbors needs an entity id', 'dks graph neighbors ID [--depth N<=3]')
      }
      return neighborsData(load(), id, depth)
    }
    case 'path': {
      const fromId = operands.at(1)
      const toId = operands.at(2)
      if (fromId === undefined || toId === undefined) {
        throw new CliError('usage', 'graph path needs a start and a goal entity id', 'dks graph path FROM TO')
      }
      return pathData(load(), fromId, toId)
    }
    case 'stats':
      return statsData(load())
    default:
      throw new CliError('usage', `unknown graph subcommand "${sub ?? ''}"`, GRAPH_SUBCOMMANDS)
  }
}
