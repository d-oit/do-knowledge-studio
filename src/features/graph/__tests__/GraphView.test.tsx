/**
 * Unit tests for GraphView data wiring and snapshot operations.
 *
 * GraphView itself is hard to mount (Sigma.js + heavy deps), so we test the
 * pure data layer (buildGraphologyInstance) plus the snapshot round-trip
 * through the Zod schemas. Component-level integration is covered by E2E.
 */

import { describe, it, expect } from 'vitest';
import {
  buildGraphologyInstance,
  diffGraphNodes,
  PLACEHOLDER_NODE_ID,
} from '../../../lib/graph-data';
import { GraphNodeSchema, GraphEdgeSchema } from '../graph-schemas';
import type { Entity, Link } from '../../../lib/validation';

function makeEntity(overrides: Partial<Entity>): Entity {
  return {
    id: 'e1',
    name: 'E1',
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
  };
}

describe('GraphView data layer', () => {
  it('renders a graph from entities and links', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })],
      links: [makeLink({ id: 'l1', source_id: 'a', target_id: 'b' })],
    });
    expect(result.graph.order).toBe(2);
    expect(result.graph.size).toBe(1);
    expect(result.hasPlaceholder).toBe(false);
  });

  it('shows a placeholder when there are no entities', () => {
    const result = buildGraphologyInstance({ entities: [], links: [] });
    expect(result.hasPlaceholder).toBe(true);
    expect(result.graph.hasNode(PLACEHOLDER_NODE_ID)).toBe(true);
  });

  it('highlights the selected node', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })],
      links: [],
      selectedNodeId: 'b',
    });
    expect(result.graph.getNodeAttribute('b', 'size')).toBe(20);
  });

  it('uses snapshot color when snapshotMode is enabled', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' })],
      links: [],
      snapshotMode: true,
    });
    expect(result.graph.getNodeAttribute('a', 'color')).toBe('#8b5cf6');
  });
});

describe('GraphView snapshot round-trip', () => {
  it('parses serialized nodes and edges against Zod schemas', () => {
    const result = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a', name: 'Alpha' })],
      links: [],
    });
    const nodesJson = JSON.stringify(
      result.graph.mapNodes((id, attrs) => {
        const attrsRecord = attrs as { label?: string };
        return { id: String(id), label: attrsRecord.label ?? '' };
      }),
    );
    const edgesJson = JSON.stringify(
      result.graph.mapEdges((_edge, attrs, source, target) => {
        const attrsRecord = attrs as { id?: string };
        const idValue = attrsRecord.id;
        return {
          id: idValue ?? `${String(source)}->${String(target)}`,
          source: String(source),
          target: String(target),
        };
      }),
    );
    const parsedNodes = (JSON.parse(nodesJson) as unknown[]).map(n =>
      GraphNodeSchema.parse(n),
    );
    const parsedEdges = (JSON.parse(edgesJson) as unknown[]).map(e =>
      GraphEdgeSchema.parse(e),
    );
    expect(parsedNodes).toHaveLength(1);
    expect(parsedNodes[0].id).toBe('a');
    expect(parsedEdges).toHaveLength(0);
  });

  it('rejects malformed node payloads', () => {
    expect(() => GraphNodeSchema.parse({})).toThrow();
    expect(() => GraphNodeSchema.parse({ id: 'x' })).toThrow();
    expect(GraphNodeSchema.parse({ id: 'x', label: 'y' })).toEqual({
      id: 'x',
      label: 'y',
    });
  });

  it('rejects malformed edge payloads', () => {
    expect(() => GraphEdgeSchema.parse({ id: '1' })).toThrow();
    expect(() => GraphEdgeSchema.parse({ id: '1', source: 'a' })).toThrow();
    expect(
      GraphEdgeSchema.parse({ id: '1', source: 'a', target: 'b' }),
    ).toEqual({ id: '1', source: 'a', target: 'b' });
  });
});

describe('GraphView diff', () => {
  it('reports removed nodes between two graph instances', () => {
    const prev = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })],
      links: [],
    }).graph;
    const next = buildGraphologyInstance({
      entities: [makeEntity({ id: 'a' })],
      links: [],
    }).graph;
    const removed = diffGraphNodes(prev, next);
    expect(removed).toContain('b');
    expect(removed).not.toContain('a');
  });
});
