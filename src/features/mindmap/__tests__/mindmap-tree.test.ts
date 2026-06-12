import { describe, it, expect } from 'vitest';
import { buildTree } from '../../../lib/mindmap-tree';
import type { Entity, Link } from '../../../lib/validation';

const entity = (id: string, name: string): Entity => ({
  id,
  name,
  type: 'concept',
});

const link = (source_id: string, target_id: string, relation = 'hierarchy'): Link => ({
  source_id,
  target_id,
  relation,
});

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const UUID_D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('buildTree', () => {
  describe('empty entities', () => {
    it('returns null for empty entities array', () => {
      expect(buildTree(UUID_A, 0, 5, [], [], 'all')).toBeNull();
    });
  });

  describe('single entity', () => {
    it('returns a single root node with no children', () => {
      const result = buildTree(UUID_A, 0, 2, [entity(UUID_A, 'Root')], [], 'all');
      expect(result).toEqual({
        id: UUID_A,
        topic: 'Root',
        children: [],
      });
    });
  });

  describe('parent-child links', () => {
    it('builds correct tree structure with one child', () => {
      const entities = [
        entity(UUID_A, 'Parent'),
        entity(UUID_B, 'Child'),
      ];
      const links = [link(UUID_A, UUID_B)];
      const result = buildTree(UUID_A, 0, 2, entities, links, 'all');
      expect(result).toEqual({
        id: UUID_A,
        topic: 'Parent',
        children: [
          { id: UUID_B, topic: 'Child', children: [] },
        ],
      });
    });

    it('builds correct tree structure with multiple children', () => {
      const entities = [
        entity(UUID_A, 'Parent'),
        entity(UUID_B, 'Child1'),
        entity(UUID_C, 'Child2'),
      ];
      const links = [
        link(UUID_A, UUID_B),
        link(UUID_A, UUID_C),
      ];
      const result = buildTree(UUID_A, 0, 2, entities, links, 'all');
      expect(result!.children).toHaveLength(2);
      expect(result!.children.map(c => c.topic)).toEqual(['Child1', 'Child2']);
    });

    it('builds nested tree (grandchild)', () => {
      const entities = [
        entity(UUID_A, 'Root'),
        entity(UUID_B, 'Child'),
        entity(UUID_C, 'Grandchild'),
      ];
      const links = [
        link(UUID_A, UUID_B),
        link(UUID_B, UUID_C),
      ];
      const result = buildTree(UUID_A, 0, 3, entities, links, 'all');
      expect(result!.children[0].topic).toBe('Child');
      expect(result!.children[0].children[0].topic).toBe('Grandchild');
    });
  });

  describe('depth limit', () => {
    it('respects maxDepth', () => {
      const entities = [
        entity(UUID_A, 'Root'),
        entity(UUID_B, 'Child'),
        entity(UUID_C, 'Grandchild'),
      ];
      const links = [
        link(UUID_A, UUID_B),
        link(UUID_B, UUID_C),
      ];
      const result = buildTree(UUID_A, 0, 1, entities, links, 'all');
      expect(result!.children[0].topic).toBe('Child');
      expect(result!.children[0].children).toEqual([]);
    });

    it('returns null when depth exceeds maxDepth', () => {
      const entities = [entity(UUID_A, 'Root')];
      expect(buildTree(UUID_A, 3, 2, entities, [], 'all')).toBeNull();
    });
  });

  describe('relation filter', () => {
    it('filters links by relation type', () => {
      const entities = [
        entity(UUID_A, 'Root'),
        entity(UUID_B, 'HierarchyChild'),
        entity(UUID_C, 'RelatedChild'),
      ];
      const links = [
        link(UUID_A, UUID_B, 'hierarchy'),
        link(UUID_A, UUID_C, 'related'),
      ];
      const result = buildTree(UUID_A, 0, 2, entities, links, 'hierarchy');
      expect(result!.children).toHaveLength(1);
      expect(result!.children[0].topic).toBe('HierarchyChild');
    });

    it('returns all children when filter is "all"', () => {
      const entities = [
        entity(UUID_A, 'Root'),
        entity(UUID_B, 'Child1'),
        entity(UUID_C, 'Child2'),
      ];
      const links = [
        link(UUID_A, UUID_B, 'hierarchy'),
        link(UUID_A, UUID_C, 'related'),
      ];
      const result = buildTree(UUID_A, 0, 2, entities, links, 'all');
      expect(result!.children).toHaveLength(2);
    });
  });

  describe('null/undefined entity handling', () => {
    it('returns null for non-existent entity', () => {
      expect(buildTree('nonexistent-id', 0, 2, [entity(UUID_A, 'X')], [], 'all')).toBeNull();
    });

    it('returns null when entity has no matching id', () => {
      const entities = [entity(UUID_A, 'Alpha'), entity(UUID_B, 'Beta')];
      expect(buildTree(UUID_C, 0, 5, entities, [], 'all')).toBeNull();
    });
  });

  describe('circular reference protection', () => {
    it('handles circular links without infinite recursion', () => {
      const entities = [
        entity(UUID_A, 'A'),
        entity(UUID_B, 'B'),
      ];
      const links = [
        link(UUID_A, UUID_B),
        link(UUID_B, UUID_A),
      ];
      const result = buildTree(UUID_A, 0, 10, entities, links, 'all');
      expect(result).toBeDefined();
      expect(result!.id).toBe(UUID_A);
      expect(result!.children[0].id).toBe(UUID_B);
      expect(result!.children[0].children).toEqual([]);
    });

    it('handles self-referencing link', () => {
      const entities = [entity(UUID_A, 'Self')];
      const links = [link(UUID_A, UUID_A)];
      const result = buildTree(UUID_A, 0, 5, entities, links, 'all');
      expect(result).toBeDefined();
      expect(result!.id).toBe(UUID_A);
    });
  });

  describe('node fallback id', () => {
    it('generates fallback id when entity has no id', () => {
      const entities = [{ name: 'NoId', type: 'note' } as Entity];
      const result = buildTree('any', 0, 2, entities, [], 'all');
      expect(result).toBeNull();
    });
  });

  describe('complex tree', () => {
    it('builds a full multi-level tree', () => {
      const entities = [
        entity(UUID_A, 'Root'),
        entity(UUID_B, 'B'),
        entity(UUID_C, 'C'),
        entity(UUID_D, 'D'),
      ];
      const links = [
        link(UUID_A, UUID_B),
        link(UUID_A, UUID_C),
        link(UUID_B, UUID_D),
      ];
      const result = buildTree(UUID_A, 0, 5, entities, links, 'all');
      expect(result!.topic).toBe('Root');
      expect(result!.children).toHaveLength(2);
      const bChild = result!.children.find(c => c.topic === 'B')!;
      expect(bChild.children).toHaveLength(1);
      expect(bChild.children[0].topic).toBe('D');
    });
  });
});
