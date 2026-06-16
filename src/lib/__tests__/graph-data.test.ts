/**
 * Unit tests for the graph-data pure data transform module.
 * @see ADR-014 Test Architecture: Pure Data Transforms
 */

import { describe, it, expect } from 'vitest';
import Graph from 'graphology';
import {
  buildGraphologyInstance,
  diffGraphNodes,
  PLACEHOLDER_NODE_ID,
  SELECTED_NODE_COLOR,
  DEFAULT_NODE_COLOR,
  SNAPSHOT_NODE_COLOR,
} from '../graph-data';
import type { Entity, Link } from '../validation';

function makeEntity(overrides: Partial<Entity>): Entity {
  return {
    id: 'e1',
    name: 'Test',
    type: 'concept',
    content: '',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Entity;
}

function makeLink(overrides: Partial<Link>): Link {
  return {
    id: 'l1',
    source_id: 'e1',
    target_id: 'e2',
    relation: 'references',
    ...overrides,
  } as Link;
}

describe('buildGraphologyInstance', () => {
  it('returns empty graph and adds placeholder for empty entities', () => {
    const result = buildGraphologyInstance({ entities: [], links: [] });
    expect(result.nodeCount).toBe(1);
    expect(result.hasPlaceholder).toBe(true);
    expect(result.graph.hasNode(PLACEHOLDER_NODE_ID)).toBe(true);
  });

  it('creates a node per entity with correct label', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a', name: 'Alpha' }), makeEntity({ id: 'b', name: 'Beta' })],
      links: [],
    });
    expect(result.nodeCount).toBe(2);
    expect(result.graph.getNodeAttribute('a', 'label')).toBe('Alpha');
    expect(result.graph.getNodeAttribute('b', 'label')).toBe('Beta');
  });

  it('adds an edge for each link with source and target present', () => {
    const result = buildGraphologyInstance({
      entities: [
        makeEntity({ id: 'a' }),
        makeEntity({ id: 'b' }),
        makeEntity({ id: 'c' }),
      ],
      links: [
        makeLink({ id: 'l1', source_id: 'a', target_id: 'b' }),
        makeLink({ id: 'l2', source_id: 'b', target_id: 'c' }),
      ],
    });
    expect(result.edgeCount).toBe(2);
    expect(result.graph.hasEdge('a', 'b')).toBe(true);
    expect(result.graph.hasEdge('b', 'c')).toBe(true);
  });

  it('skips edges whose source or target is not in the graph', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' })],
      links: [makeLink({ id: 'l1', source_id: 'a', target_id: 'missing' })],
    });
    expect(result.edgeCount).toBe(0);
  });

  it('marks the selected node with the SELECTED color and size 20', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })],
      links: [],
      selectedNodeId: 'b',
    });
    expect(result.graph.getNodeAttribute('a', 'color')).toBe(DEFAULT_NODE_COLOR);
    expect(result.graph.getNodeAttribute('b', 'color')).toBe(SELECTED_NODE_COLOR);
    expect(result.graph.getNodeAttribute('b', 'size')).toBe(20);
  });

  it('uses snapshot color when snapshotMode is true', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' })],
      links: [],
      snapshotMode: true,
    });
    expect(result.graph.getNodeAttribute('a', 'color')).toBe(SNAPSHOT_NODE_COLOR);
  });

  it('handles duplicate entities by keeping the first', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'a', name: 'Dup' })],
      links: [],
    });
    expect(result.nodeCount).toBe(1);
    expect(result.graph.getNodeAttribute('a', 'label')).toBe('Test');
  });

  it('skips entities with empty id', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: '' as string }), makeEntity({ id: 'real' })],
      links: [],
    });
    expect(result.nodeCount).toBe(1);
    expect(result.graph.hasNode('real')).toBe(true);
  });

  it('avoids duplicate edges in multi-link scenarios', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })],
      links: [
        makeLink({ id: 'l1', source_id: 'a', target_id: 'b' }),
        makeLink({ id: 'l2', source_id: 'a', target_id: 'b' }),
      ],
    });
    expect(result.edgeCount).toBe(1);
  });
});

describe('diffGraphNodes', () => {
  it('returns node ids present in prev but missing in next', () => {
    const prev = new Graph();
    prev.addNode('a');
    prev.addNode('b');
    const next = new Graph();
    next.addNode('a');
    const removed = diffGraphNodes(prev, next);
    expect(removed).toEqual(['b']);
  });

  it('returns empty array when graphs are identical', () => {
    const prev = new Graph();
    prev.addNode('a');
    const next = new Graph();
    next.addNode('a');
    expect(diffGraphNodes(prev, next)).toEqual([]);
  });
});
