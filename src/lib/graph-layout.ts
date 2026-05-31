import Graph from 'graphology';
import { Entity, Link } from './validation';
import { inferSettings, assign as assignFA2Layout } from 'graphology-layout-forceatlas2';

/** Apply hierarchical layout to the graph based on link direction. */
export function applyHierarchicalLayout(graph: Graph, nodes: Entity[], links: Link[]) {
  // Compute ranks based on link direction
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  nodes.forEach(n => { inDegree.set(n.id!, 0); outDegree.set(n.id!, 0); });
  links.forEach(l => {
    if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
      outDegree.set(l.source_id, (outDegree.get(l.source_id) || 0) + 1);
      inDegree.set(l.target_id, (inDegree.get(l.target_id) || 0) + 1);
    }
  });

  // BFS from root nodes (nodes with no incoming links)
  const visited = new Set<string>();
  const levels = new Map<string, number>();
  const queue: string[] = [];

  nodes.forEach(n => {
    if ((inDegree.get(n.id!) || 0) === 0) {
      queue.push(n.id!);
      levels.set(n.id!, 0);
    }
  });

  // Fallback: if no root nodes, use node with most outgoing links
  if (queue.length === 0 && nodes.length > 0) {
    let maxOut = -1;
    let bestNode = nodes[0].id!;
    nodes.forEach(n => {
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

  // Assign positions based on level and rank within level
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

/** Apply circular layout to the graph. */
export function applyCircularLayout(graph: Graph, nodes: { id: string }[]) {
  const n = nodes.length;
  if (n === 0) return;
  const radius = Math.max(200, n * 30);
  nodes.forEach((node, i) => {
    const angle = (i * 2 * Math.PI) / n;
    graph.setNodeAttribute(node.id, 'x', Math.cos(angle) * radius);
    graph.setNodeAttribute(node.id, 'y', Math.sin(angle) * radius);
  });
}

/** Apply ForceAtlas2 layout to the graph. */
export function applyForceLayout(graph: Graph) {
  if (graph.order === 0) return;
  const settings = inferSettings(graph);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  assignFA2Layout(graph, { settings, iterations: 100 });
}
