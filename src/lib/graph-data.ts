import Graph from 'graphology';
import { assign as assignFA2Layout, inferSettings } from 'graphology-layout-forceatlas2';
import type { Entity, Link } from './validation';

export type LayoutType = 'circular' | 'force' | 'hierarchical';

export function buildGraphologyInstance(entities: Entity[], links: Link[], options: { selectedNode?: string | null, snapshotMode?: boolean } = {}): Graph {
  const graph = new Graph();
  const { selectedNode, snapshotMode } = options;

  if (entities.length === 0 && !selectedNode && !snapshotMode) {
    graph.addNode('placeholder', { label: 'Knowledge Studio', size: 10, color: '#2563eb', x: 0, y: 0 });
    return graph;
  }

  entities.forEach((e, i) => {
    const nodeColor = snapshotMode ? '#8b5cf6' : (e.id === selectedNode ? '#ef4444' : '#2563eb');
    if (!graph.hasNode(e.id!)) {
      graph.addNode(e.id!, {
        label: e.name,
        size: e.id === selectedNode ? 20 : 10,
        color: nodeColor,
        x: Math.cos((i * 2 * Math.PI) / entities.length),
        y: Math.sin((i * 2 * Math.PI) / entities.length)
      });
    }
  });

  links.forEach((l) => {
    if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
      graph.mergeEdge(l.source_id, l.target_id, {
        label: l.relation,
        size: 2,
        color: snapshotMode ? '#a78bfa' : '#94a3b8'
      });
    }
  });

  return graph;
}

export function applyHierarchicalLayout(graph: Graph, entities: Entity[], links: Link[]): void {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  entities.forEach(n => { inDegree.set(n.id!, 0); outDegree.set(n.id!, 0); });
  links.forEach(l => {
    if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
      outDegree.set(l.source_id, (outDegree.get(l.source_id) || 0) + 1);
      inDegree.set(l.target_id, (inDegree.get(l.target_id) || 0) + 1);
    }
  });

  const visited = new Set<string>();
  const levels = new Map<string, number>();
  const queue: string[] = [];

  entities.forEach(n => {
    if ((inDegree.get(n.id!) || 0) === 0) {
      queue.push(n.id!);
      levels.set(n.id!, 0);
    }
  });

  if (queue.length === 0 && entities.length > 0) {
    let maxOut = -1;
    let bestNode = entities[0].id!;
    entities.forEach(n => {
      const out = outDegree.get(n.id!) || 0;
      if (out > maxOut) { maxOut = out; bestNode = n.id!; }
    });
    queue.push(bestNode);
    levels.set(bestNode, 0);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const currentLevel = levels.get(currentId) || 0;
    links.forEach(l => {
      if (l.source_id === currentId && !visited.has(l.target_id) && graph.hasNode(l.target_id)) {
        levels.set(l.target_id, currentLevel + 1);
        queue.push(l.target_id);
      }
    });
  }

  const levelBuckets = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!levelBuckets.has(level)) levelBuckets.set(level, []);
    levelBuckets.get(level)!.push(nodeId);
  });

  const levelSpacing = 300;
  const nodeSpacing = 120;
  levelBuckets.forEach((nodeIds, level) => {
    const totalWidth = (nodeIds.length - 1) * nodeSpacing;
    nodeIds.forEach((nodeId, idx) => {
      const x = level * levelSpacing - 500;
      const y = idx * nodeSpacing - totalWidth / 2;
      graph.setNodeAttribute(nodeId, 'x', x);
      graph.setNodeAttribute(nodeId, 'y', y + 100);
    });
  });
}

export function applyCircularLayout(graph: Graph, entities: { id?: string }[]): void {
  const n = entities.length;
  if (n === 0) return;
  const radius = Math.max(200, n * 30);
  entities.forEach((node, i) => {
    if (node.id && graph.hasNode(node.id)) {
      const angle = (i * 2 * Math.PI) / n;
      graph.setNodeAttribute(node.id, 'x', Math.cos(angle) * radius);
      graph.setNodeAttribute(node.id, 'y', Math.sin(angle) * radius);
    }
  });
}

export function applyForceLayout(graph: Graph): void {
  if (graph.order === 0) return;
  const settings = inferSettings(graph);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  assignFA2Layout(graph, { settings, iterations: 100 });
}
