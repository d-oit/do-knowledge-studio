import { describe, it, expect } from 'vitest';
import { buildGraphologyInstance, applyHierarchicalLayout, applyCircularLayout, applyForceLayout } from '../graph-data';
import type { Entity, Link } from '../validation';

describe('graph-data', () => {
  const mockEntities: Entity[] = [
    { id: '1', name: 'E1', type: 'concept' },
    { id: '2', name: 'E2', type: 'concept' },
    { id: '3', name: 'E3', type: 'concept' },
  ];

  const mockLinks: Link[] = [
    { id: 'l1', source_id: '1', target_id: '2', relation: 'rel' },
    { id: 'l2', source_id: '2', target_id: '3', relation: 'rel' },
  ];

  describe('buildGraphologyInstance', () => {
    it('returns a placeholder node for empty graph', () => {
      const graph = buildGraphologyInstance([], []);
      expect(graph.hasNode('placeholder')).toBe(true);
    });

    it('creates nodes and edges', () => {
      const graph = buildGraphologyInstance(mockEntities, mockLinks);
      expect(graph.order).toBe(3);
      expect(graph.size).toBe(2);
      expect(graph.hasNode('1')).toBe(true);
      expect(graph.hasEdge('1', '2')).toBe(true);
    });

    it('sets correct color for selected node', () => {
      const graph = buildGraphologyInstance(mockEntities, mockLinks, { selectedNode: '1' });
      expect(graph.getNodeAttribute('1', 'color')).toBe('#ef4444');
      expect(graph.getNodeAttribute('2', 'color')).toBe('#2563eb');
    });

    it('handles snapshot mode colors', () => {
      const graph = buildGraphologyInstance(mockEntities, mockLinks, { snapshotMode: true });
      expect(graph.getNodeAttribute('1', 'color')).toBe('#8b5cf6');
      expect(graph.getEdgeAttribute('1', '2', 'color')).toBe('#a78bfa');
    });
  });

  describe('layout functions', () => {
    it('applyCircularLayout assigns positions', () => {
      const graph = buildGraphologyInstance(mockEntities, []);
      applyCircularLayout(graph, mockEntities);
      expect(graph.getNodeAttribute('1', 'x')).toBeDefined();
      expect(graph.getNodeAttribute('1', 'y')).toBeDefined();
    });

    it('applyHierarchicalLayout assigns levels', () => {
      const graph = buildGraphologyInstance(mockEntities, mockLinks);
      applyHierarchicalLayout(graph, mockEntities, mockLinks);
      // E1 is root (level 0), E2 is level 1, E3 is level 2
      // hierarchical layout sets x based on level
      const x1 = graph.getNodeAttribute('1', 'x');
      const x2 = graph.getNodeAttribute('2', 'x');
      const x3 = graph.getNodeAttribute('3', 'x');
      expect(x1).toBeLessThan(x2);
      expect(x2).toBeLessThan(x3);
    });

    it('applyForceLayout runs without error', () => {
        const graph = buildGraphologyInstance(mockEntities, mockLinks);
        // Better mock or ensure it doesn't crash
        expect(() => applyForceLayout(graph)).not.toThrow();
    });
  });
});
