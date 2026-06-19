import { describe, it, expect } from 'vitest';
import { buildTree, addAriaToNodes } from '../../lib/mindmap-tree';
import type { Entity, Link } from '../../lib/validation';

describe('buildTree', () => {
  const mockEntities: Entity[] = [
    { id: '1', name: 'Root', type: 'concept', content: '', created_at: '', updated_at: '' },
    { id: '2', name: 'Child 1', type: 'concept', content: '', created_at: '', updated_at: '' },
    { id: '3', name: 'Child 2', type: 'concept', content: '', created_at: '', updated_at: '' },
    { id: '4', name: 'Grandchild', type: 'concept', content: '', created_at: '', updated_at: '' },
  ];

  const mockLinks: Link[] = [
    { id: 'l1', source_id: '1', target_id: '2', relation: 'contains', created_at: '' },
    { id: 'l2', source_id: '1', target_id: '3', relation: 'contains', created_at: '' },
    { id: 'l3', source_id: '2', target_id: '4', relation: 'contains', created_at: '' },
  ];

  it('should return null for empty entities array', () => {
    const result = buildTree('1', 0, 5, [], [], 'all');
    expect(result).toBeNull();
  });

  it('should return single root node for entity with no children', () => {
    const result = buildTree('1', 0, 5, mockEntities, [], 'all');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('1');
    expect(result?.topic).toBe('Root');
    expect(result?.children).toHaveLength(0);
  });

  it('should build correct tree structure with parent-child links', () => {
    const result = buildTree('1', 0, 5, mockEntities, mockLinks, 'all');
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(2);
    expect(result?.children[0].topic).toBe('Child 1');
    expect(result?.children[1].topic).toBe('Child 2');
  });

  it('should respect depth limit', () => {
    const result = buildTree('1', 0, 1, mockEntities, mockLinks, 'all');
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(2);
    // Grandchild should not be included due to depth limit
    expect(result?.children[0].children).toHaveLength(0);
  });

  it('should filter by relation type', () => {
    const linksWithDifferentRelations: Link[] = [
      { id: 'l1', source_id: '1', target_id: '2', relation: 'contains', created_at: '' },
      { id: 'l2', source_id: '1', target_id: '3', relation: 'related_to', created_at: '' },
    ];

    const result = buildTree('1', 0, 5, mockEntities, linksWithDifferentRelations, 'contains');
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0].topic).toBe('Child 1');
  });

  it('should handle null entity gracefully', () => {
    const result = buildTree('nonexistent', 0, 5, mockEntities, mockLinks, 'all');
    expect(result).toBeNull();
  });

  it('should handle circular references', () => {
    const circularLinks: Link[] = [
      { id: 'l1', source_id: '1', target_id: '2', relation: 'contains', created_at: '' },
      { id: 'l2', source_id: '2', target_id: '1', relation: 'contains', created_at: '' },
    ];

    // This should not cause infinite recursion
    const result = buildTree('1', 0, 10, mockEntities, circularLinks, 'all');
    expect(result).not.toBeNull();
    // The tree should be built with the depth limit preventing infinite recursion
  });

  it('should generate random ID if entity has no ID', () => {
    const entitiesWithoutId: Entity[] = [
      { id: '', name: 'No ID Entity', type: 'concept', content: '', created_at: '', updated_at: '' },
    ];

    const result = buildTree('', 0, 5, entitiesWithoutId, [], 'all');
    expect(result).not.toBeNull();
    expect(result?.id).toMatch(/^node-/);
  });
});

describe('addAriaToNodes', () => {
  it('should add ARIA attributes to mind map nodes', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <me-parent>
        <me-tpc>Test Node</me-tpc>
      </me-parent>
    `;

    addAriaToNodes(container);

    const parent = container.querySelector('me-parent');
    expect(parent?.getAttribute('role')).toBe('treeitem');
    expect(parent?.getAttribute('aria-label')).toBe('Test Node');
  });

  it('should handle empty node list', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div>No nodes</div>';

    // Should not throw
    addAriaToNodes(container);
  });

  it('should not overwrite existing role attribute', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <me-parent role="existing-role">
        <me-tpc>Test Node</me-tpc>
      </me-parent>
    `;

    addAriaToNodes(container);

    const parent = container.querySelector('me-parent');
    expect(parent?.getAttribute('role')).toBe('existing-role');
  });
});
