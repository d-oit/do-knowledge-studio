/**
 * Graph data builder - Pure data transformation for knowledge graph rendering.
 *
 * Converts a flat (entities, links) pair into a graphology Graph instance
 * suitable for Sigma.js or any graph renderer. All functions are pure
 * (no React, no I/O) for unit-testability.
 *
 * @see ADR-014 Test Architecture: Pure Data Transforms
 */

import Graph from 'graphology';
import type { Entity, Link } from './validation';

export const DEFAULT_NODE_SIZE = 10;
export const SELECTED_NODE_SIZE = 20;
export const PLACEHOLDER_NODE_ID = 'placeholder';
export const DEFAULT_NODE_COLOR = '#2563eb';
export const SELECTED_NODE_COLOR = '#ef4444';
export const SNAPSHOT_NODE_COLOR = '#8b5cf6';

export interface BuildGraphOptions {
  entities: Entity[];
  links: Link[];
  selectedNodeId?: string | null;
  snapshotMode?: boolean;
}

export interface BuildGraphResult {
  graph: Graph;
  hasPlaceholder: boolean;
  nodeCount: number;
  edgeCount: number;
}

export function buildGraphologyInstance(opts: BuildGraphOptions): BuildGraphResult {
  const { entities, links, selectedNodeId = null, snapshotMode = false } = opts;
  const graph = new Graph({ type: 'directed', multi: true });

  const hasPlaceholder = entities.length === 0;
  if (hasPlaceholder) {
    graph.addNode(PLACEHOLDER_NODE_ID, {
      label: 'Knowledge Studio',
      size: DEFAULT_NODE_SIZE,
      color: DEFAULT_NODE_COLOR,
      x: 0,
      y: 0,
    });
  }

  entities.forEach((e, i) => {
    const entityId = e.id;
    if (!entityId) return;
    if (graph.hasNode(entityId)) return;

    const isSelected = entityId === selectedNodeId;
    const color = snapshotMode
      ? SNAPSHOT_NODE_COLOR
      : isSelected
        ? SELECTED_NODE_COLOR
        : DEFAULT_NODE_COLOR;
    const size = isSelected ? SELECTED_NODE_SIZE : DEFAULT_NODE_SIZE;

    graph.addNode(entityId, {
      label: e.name,
      size,
      color,
      x: Math.cos((i * 2 * Math.PI) / Math.max(entities.length, 1)),
      y: Math.sin((i * 2 * Math.PI) / Math.max(entities.length, 1)),
    });
  });

  for (const link of links) {
    const source = link.source_id;
    const target = link.target_id;
    if (!source || !target) continue;
    if (!graph.hasNode(source) || !graph.hasNode(target)) continue;
    if (graph.hasEdge(source, target)) continue;
    graph.addEdge(source, target, { id: link.id, label: link.relation });
  }

  return {
    graph,
    hasPlaceholder,
    nodeCount: graph.order,
    edgeCount: graph.size,
  };
}

export function diffGraphNodes(prev: Graph, next: Graph): string[] {
  const removed: string[] = [];
  for (const nodeId of prev.nodes()) {
    if (!next.hasNode(nodeId)) removed.push(nodeId);
  }
  return removed;
}
