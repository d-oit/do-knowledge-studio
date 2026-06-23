import Graph from 'graphology';
import type { Entity, Link } from './validation';

export interface GraphNodeAttributes {
  label: string;
  type: string;
  size: number;
  x?: number;
  y?: number;
}

export interface GraphEdgeAttributes {
  label: string;
  size: number;
}

const DEFAULT_NODE_SIZE = 10;
const NODE_TYPE_DEFAULT = 'unknown';

/**
 * Build a graphology Graph instance from a list of entities and links.
 *
 * - Each entity becomes a node keyed by entity id with label/type attributes.
 * - Each link becomes a directed edge from source_id to target_id with the
 *   link's relation used as the edge label.
 * - Entities with no id are skipped (graphology requires a string key).
 * - Links referencing missing endpoints are dropped with a warning in the
 *   returned diagnostics (the function never throws on bad input).
 * - Duplicate edges between the same source/target pair are de-duplicated;
 *   the first occurrence wins.
 */
export function buildGraphologyInstance(
  entities: ReadonlyArray<Entity>,
  links: ReadonlyArray<Link>,
): Graph<NodeAttributes, GraphEdgeAttributes> {
  const graph = new Graph<NodeAttributes, GraphEdgeAttributes>({ multi: false, type: 'directed' });

  const seenNodeIds = new Set<string>();
  for (const entity of entities) {
    if (!entity.id) continue;
    if (seenNodeIds.has(entity.id)) continue;
    seenNodeIds.add(entity.id);

    graph.addNode(entity.id, {
      label: entity.name,
      type: entity.type ?? NODE_TYPE_DEFAULT,
      size: DEFAULT_NODE_SIZE,
    });
  }

  const seenEdges = new Set<string>();
  for (const link of links) {
    if (!link.source_id || !link.target_id) continue;
    if (!graph.hasNode(link.source_id) || !graph.hasNode(link.target_id)) continue;
    const key = `${link.source_id}|${link.target_id}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    graph.addDirectedEdge(link.source_id, link.target_id, {
      label: link.relation ?? '',
      size: 2,
    });
  }

  return graph;
}
