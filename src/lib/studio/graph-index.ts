import type { Entity } from './types'

/**
 * Build a Map<id, Entity> for O(1) entity lookups. Use in components that
 * do repeated `entities.find(e => e.id === ...)` inside loops (graph, mindmap).
 */
export function buildEntityIndex(entities: Entity[]): Map<string, Entity> {
  const index = new Map<string, Entity>()
  for (const entity of entities) {
    index.set(entity.id, entity)
  }
  return index
}

/**
 * Build a Map<entityId, Set<linkedEntityId>> for O(1) edge lookups.
 * Useful for graph adjacency queries without scanning all edges.
 */
export function buildAdjacencyIndex(
  entities: Entity[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const entity of entities) {
    if (!adjacency.has(entity.id)) {
      adjacency.set(entity.id, new Set())
    }
    for (const link of entity.links) {
      adjacency.get(entity.id)!.add(link.targetId)
      // Undirected: add reverse edge
      if (!adjacency.has(link.targetId)) {
        adjacency.set(link.targetId, new Set())
      }
      adjacency.get(link.targetId)!.add(entity.id)
    }
  }
  return adjacency
}
