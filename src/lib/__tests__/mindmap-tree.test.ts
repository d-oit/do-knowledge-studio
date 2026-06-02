import { describe, it, expect, vi } from 'vitest';
import { buildTree, addAriaToNodes, addAriaAttributesToContainer } from '../mindmap-tree';
import type { Entity, Link } from '../validation';

describe('mindmap-tree', () => {
  const mockEntities: Entity[] = [
    { id: '1', name: 'Root', type: 'concept' },
    { id: '2', name: 'Child 1', type: 'concept' },
    { id: '3', name: 'Child 2', type: 'concept' },
    { id: '4', name: 'Grandchild', type: 'concept' },
  ];

  const mockLinks: Link[] = [
    { id: 'l1', source_id: '1', target_id: '2', relation: 'child' },
    { id: 'l2', source_id: '1', target_id: '3', relation: 'related' },
    { id: 'l3', source_id: '2', target_id: '4', relation: 'child' },
  ];

  describe('buildTree', () => {
    it('returns null if entity not found', () => {
      expect(buildTree('non-existent', 0, 2, mockEntities, [], 'all')).toBeNull();
    });

    it('respects maxDepth', () => {
      const tree = buildTree('1', 0, 1, mockEntities, mockLinks, 'all');
      expect(tree?.topic).toBe('Root');
      expect(tree?.children).toHaveLength(2);
      expect(tree?.children?.[0].children).toHaveLength(0);
    });

    it('filters by relation', () => {
      const tree = buildTree('1', 0, 2, mockEntities, mockLinks, 'child');
      expect(tree?.children).toHaveLength(1);
      expect(tree?.children?.[0].topic).toBe('Child 1');
    });

    it('prevents circular references', () => {
      const circularLinks: Link[] = [
        { id: 'l1', source_id: '1', target_id: '2', relation: 'child' },
        { id: 'l2', source_id: '2', target_id: '1', relation: 'child' },
      ];
      const tree = buildTree('1', 0, 5, mockEntities, circularLinks, 'all');
      expect(tree?.children).toHaveLength(1);
      expect(tree?.children?.[0].children).toHaveLength(0);
    });

    it('handles empty data', () => {
      expect(buildTree('1', 0, 2, [], [], 'all')).toBeNull();
    });
  });

  describe('ARIA helpers', () => {
    it('addAriaToNodes adds role and aria-label', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <me-parent>
          <me-tpc>Node 1</me-tpc>
        </me-parent>
      `;
      addAriaToNodes(container);
      const parent = container.querySelector('me-parent');
      expect(parent?.getAttribute('role')).toBe('treeitem');
      expect(parent?.getAttribute('aria-label')).toBe('Node 1');
    });

    it('addAriaAttributesToContainer sets role and sets up observer', () => {
      vi.useFakeTimers();
      const container = document.createElement('div');
      addAriaAttributesToContainer(container);
      expect(container.getAttribute('role')).toBe('tree');
      vi.runAllTimers();
      vi.useRealTimers();
    });
  });
});
