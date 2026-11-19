/**
 * Read-only bundle index shared by the `dks` CLI and the MCP adapter.
 *
 * Lookup/tag census bookkeeping lives here, but every ranking and every
 * graph traversal delegates to the single shared engines (`pwa-retrieval`
 * and `graph-path`), which are the same implementations the PWA uses via its
 * re-export facades. There is no second search/graph implementation.
 */

import { buildUndirectedAdjacency, findShortestPath } from './graph-path.js'
import { search as pwaSearch, type PwaEntityLike } from './pwa-retrieval.js'
import type { BundleConcept } from './types.js'

/** Default result cap when the caller passes no limit. */
export const DEFAULT_LIMIT = 5

/** A scored concept returned by search. */
export interface SearchHit {
  /** The matched concept. */
  concept: BundleConcept
  /** BM25 score (higher ranks first). */
  score: number
}

/** Adapts a concept to the shared retrieval engine's entity shape. */
const toEntityDoc = (c: BundleConcept): PwaEntityLike => ({
  id: c.id,
  name: c.name,
  type: c.type,
  description: c.description,
  content: `${c.content}\n${c.claims.map((cl) => cl.statement).join('\n')}`,
  tags: c.tags,
})

/** Read-only index over bundle concepts. */
export class LibraryIndex {
  /** Concepts in bundle order. */
  private readonly concepts: BundleConcept[]
  /** Concept by id. */
  private readonly byId = new Map<string, BundleConcept>()
  /** Concept ids by lowercase name. */
  private readonly idsByName = new Map<string, string[]>()
  /** Concept docs laid out for the shared retrieval engine. */
  private readonly docs: PwaEntityLike[]
  /** Graph entities for the shared traversal engine. */
  private readonly graphEntities: Array<{ id: string; name: string; links: Array<{ targetId: string; relation: string }> }>

  /** Builds the index; keeps bundle order for stable ties. */
  constructor(concepts: BundleConcept[]) {
    this.concepts = [...concepts]
    this.docs = concepts.map(toEntityDoc)
    this.graphEntities = concepts.map((c) => ({
      id: c.id,
      name: c.name,
      links: c.relatedIds.map((targetId) => ({ targetId, relation: 'related' })),
    }))
    for (const c of concepts) {
      this.byId.set(c.id, c)
      const key = c.name.toLowerCase()
      this.idsByName.set(key, [...(this.idsByName.get(key) ?? []), c.id])
    }
  }

  /** Number of indexed concepts. */
  get size(): number {
    return this.concepts.length
  }

  /** Finds a concept by exact id. */
  getById(id: string): BundleConcept | undefined {
    return this.byId.get(id)
  }

  /** Finds concept ids sharing a case-insensitive name. */
  getIdsByName(name: string): string[] {
    return this.idsByName.get(name.toLowerCase()) ?? []
  }

  /**
   * Resolves an `id-or-name` reference: exact id first, then unique name.
   * @param ref - Concept id or name.
   * @returns The concept, or an error describing ambiguity/absence.
   */
  resolve(ref: string): { concept: BundleConcept } | { error: string } {
    const byId = this.byId.get(ref)
    if (byId) return { concept: byId }
    const ids = this.getIdsByName(ref)
    if (ids.length === 1) {
      const found = this.byId.get(ids[0] ?? '')
      if (found) return { concept: found }
    }
    if (ids.length > 1) {
      return { error: `"${ref}" names ${ids.length} concepts; pass an id instead: ${ids.join(', ')}.` }
    }
    return { error: `No concept found for "${ref}".` }
  }

  /** All concepts in bundle order. */
  all(): BundleConcept[] {
    return [...this.concepts]
  }

  /** Tag census sorted by count desc, then name descending. */
  tags(): Array<{ tag: string; count: number }> {
    const counts = new Map<string, number>()
    for (const c of this.concepts) {
      for (const t of new Set(c.tags)) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || b.tag.localeCompare(a.tag))
  }

  /**
   * Ranks concepts with the shared lexical engine (BM25, stop-word aware).
   * One hit per concept; the concept text includes claim statements.
   * @param query - Raw query text.
   * @param limit - Max hits.
   * @returns Hits ordered by score desc, bundle order breaking ties.
   */
  search(query: string, limit = DEFAULT_LIMIT): SearchHit[] {
    const capped = Math.max(Math.floor(limit), 0)
    const results = pwaSearch(this.docs, [], query, capped)
    const hits: SearchHit[] = []
    for (const result of results) {
      const concept = this.byId.get(result.id)
      if (concept) hits.push({ concept, score: result.score })
    }
    return hits
  }

  /**
   * Breadth-first shortest path between two concepts over related links,
   * computed by the shared traversal engine (undirected, name-sorted).
   * @param fromId - Start concept id.
   * @param toId - Target concept id.
   * @returns Ordered ids, or `no-path` when nothing connects the pair.
   */
  shortestPath(
    fromId: string,
    toId: string,
  ): { found: true; ids: string[] } | { found: false; reason: 'no-path' } {
    const result = findShortestPath(this.graphEntities, fromId, toId)
    if (!result.found) return { found: false, reason: 'no-path' }
    return { found: true, ids: result.nodeIds }
  }

  /**
   * One-hop neighborhood: concepts this concept links to plus concepts
   * linking back, with dangling targets dropped.
   * @param id - Concept id.
   * @returns Outgoing and incoming neighbors.
   */
  neighborhood(id: string): { outgoing: BundleConcept[]; incoming: BundleConcept[] } {
    const outgoing: BundleConcept[] = []
    for (const target of this.byId.get(id)?.relatedIds ?? []) {
      const found = this.byId.get(target)
      if (found) outgoing.push(found)
    }
    const incoming = this.concepts.filter(
      (c) => c.id !== id && c.relatedIds.includes(id),
    )
    return { outgoing, incoming }
  }

  /**
   * Graph statistics over the shared undirected adjacency: nodes, edges,
   * components, and the largest component. Bounded: O(V+E).
   */
  stats(): {
    concepts: number
    edges: number
    components: number
    largestComponent: number
    avgDegree: number
  } {
    const adjacency = buildUndirectedAdjacency(this.graphEntities)
    let edges = 0
    for (const bucket of adjacency.values()) edges += bucket.length
    edges /= 2
    const seen = new Set<string>()
    let components = 0
    let largestComponent = 0
    for (const concept of this.concepts) {
      if (seen.has(concept.id)) continue
      components += 1
      let size = 0
      const queue = [concept.id]
      seen.add(concept.id)
      for (const current of queue) {
        size += 1
        for (const edge of adjacency.get(current) ?? []) {
          const next = edge.source === current ? edge.target : edge.source
          if (seen.has(next)) continue
          seen.add(next)
          queue.push(next)
        }
      }
      if (size > largestComponent) largestComponent = size
    }
    const degree = this.concepts.length > 0 ? (2 * edges) / this.concepts.length : 0
    return { concepts: this.concepts.length, edges, components, largestComponent, avgDegree: degree }
  }
}
