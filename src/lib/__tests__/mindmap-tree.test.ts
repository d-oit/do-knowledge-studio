/**
 * Unit tests for the mindmap-tree pure data transform module.
 * @see ADR-014 Test Architecture: Pure Data Transforms
 */

import { describe, it, expect } from 'vitest';
import { buildTree, collectRelations, DEFAULT_MAX_DEPTH, ALL_RELATIONS } from '../mindmap-tree';
import type { Entity, Link } from '../validation';

function makeEntity(overrides: Partial<Entity>): Entity {
  return {
    id: 'e1',
    name: 'Test Entity',
    type: 'concept',
    content: '',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeLink(overrides: Partial<Link>): Link {
  return {
    id: 'l1',
    source_id: 'e1',
    target_id: 'e2',
    relation: 'references',
    ...overrides,
  };
}

describe('buildTree', () => {
  it('returns null for empty entities', () => {
    const result = buildTree({
      rootId: 'missing',
      entities: [],
      links: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when rootId is not in entities', () => {
    const result = buildTree({
      rootId: 'nonexistent',
      entities: [makeEntity({ id: 'a' })],
      links: [],
    });
    expect(result).toBeNull();
  });

  it('creates single node with empty children when entity has no links', () => {
    const result = buildTree({
      rootId: 'a',
      entities: [makeEntity({ id: 'a', name: 'A' })],
      links: [],
    });
    expect(result).toEqual({ id: 'a', topic: 'A', children: [] });
  });

  it('builds correct parent-child tree from links', () => {
    const entities = [
      makeEntity({ id: 'root', name: 'Root' }),
      makeEntity({ id: 'a', name: 'A' }),
      makeEntity({ id: 'b', name: 'B' }),
    ];
    const links = [
      makeLink({ id: 'l1', source_id: 'root', target_id: 'a' }),
      makeLink({ id: 'l2', source_id: 'root', target_id: 'b' }),
    ];
    const result = buildTree({ rootId: 'root', entities, links });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('root');
    expect(result?.children).toHaveLength(2);
    expect(result?.children.map(c => c.id).sort()).toEqual(['a', 'b']);
    expect(result?.children.every(c => c.children.length === 0)).toBe(true);
  });

  it('respects maxDepth limit', () => {
    const entities = [
      makeEntity({ id: 'a', name: 'A' }),
      makeEntity({ id: 'b', name: 'B' }),
      makeEntity({ id: 'c', name: 'C' }),
    ];
    const links = [
      makeLink({ id: 'l1', source_id: 'a', target_id: 'b' }),
      makeLink({ id: 'l2', source_id: 'b', target_id: 'c' }),
    ];
    const result = buildTree({ rootId: 'a', entities, links, maxDepth: 0 });
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(0);
  });

  it('handles default maxDepth gracefully', () => {
    expect(DEFAULT_MAX_DEPTH).toBeGreaterThan(0);
  });

  it('filters links by relation when relationFilter is specified', () => {
    const entities = [
      makeEntity({ id: 'a' }),
      makeEntity({ id: 'b' }),
      makeEntity({ id: 'c' }),
    ];
    const links = [
      makeLink({ id: 'l1', source_id: 'a', target_id: 'b', relation: 'supports' }),
      makeLink({ id: 'l2', source_id: 'a', target_id: 'c', relation: 'contradicts' }),
    ];
    const result = buildTree({
      rootId: 'a',
      entities,
      links,
      relationFilter: 'supports',
    });
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0].id).toBe('b');
  });

  it('includes all relations when relationFilter is "all"', () => {
    const entities = [
      makeEntity({ id: 'a' }),
      makeEntity({ id: 'b' }),
      makeEntity({ id: 'c' }),
    ];
    const links = [
      makeLink({ id: 'l1', source_id: 'a', target_id: 'b', relation: 'supports' }),
      makeLink({ id: 'l2', source_id: 'a', target_id: 'c', relation: 'contradicts' }),
    ];
    const result = buildTree({
      rootId: 'a',
      entities,
      links,
      relationFilter: ALL_RELATIONS,
    });
    expect(result?.children).toHaveLength(2);
  });

  it('ignores incoming links (only follows outgoing from each node)', () => {
    const entities = [
      makeEntity({ id: 'a' }),
      makeEntity({ id: 'b' }),
    ];
    const links = [makeLink({ id: 'l1', source_id: 'b', target_id: 'a' })];
    const result = buildTree({ rootId: 'a', entities, links });
    expect(result?.children).toHaveLength(0);
  });

  it('handles null entity entries gracefully', () => {
    const entities = [makeEntity({ id: 'a' })];
    const links = [makeLink({ id: 'l1', source_id: 'a', target_id: 'missing' })];
    const result = buildTree({ rootId: 'a', entities, links });
    expect(result?.children).toHaveLength(0);
  });

  it('protects against circular references', () => {
    const entities = [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })];
    const links = [
      makeLink({ id: 'l1', source_id: 'a', target_id: 'b' }),
      makeLink({ id: 'l2', source_id: 'b', target_id: 'a' }),
    ];
    const result = buildTree({ rootId: 'a', entities, links, maxDepth: 3 });
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0].id).toBe('b');
  });

  it('uses entity id directly without randomization', () => {
    const result = buildTree({
      rootId: 'my-id',
      entities: [makeEntity({ id: 'my-id', name: 'X' })],
      links: [],
    });
    expect(result?.id).toBe('my-id');
  });
});

describe('collectRelations', () => {
  it('returns at least "all" for empty links', () => {
    expect(collectRelations([])).toEqual([ALL_RELATIONS]);
  });

  it('returns unique relations including "all" first', () => {
    const links = [
      makeLink({ relation: 'supports' }),
      makeLink({ relation: 'contradicts' }),
      makeLink({ relation: 'supports' }),
    ];
    const result = collectRelations(links);
    expect(result[0]).toBe(ALL_RELATIONS);
    expect(result).toContain('supports');
    expect(result).toContain('contradicts');
    expect(result).toHaveLength(3);
  });
});
