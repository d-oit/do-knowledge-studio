import { describe, it, expect } from 'vitest';
import {
  GraphNodeSchema,
  GraphEdgeSchema,
  GraphSnapshotDataSchema,
  validateSnapshotData,
} from '../graph-schemas';

describe('GraphNodeSchema', () => {
  it('accepts valid node', () => {
    expect(GraphNodeSchema.parse({ id: 'n1', label: 'Test' })).toEqual({ id: 'n1', label: 'Test' });
  });

  it('rejects empty id', () => {
    expect(() => GraphNodeSchema.parse({ id: '', label: 'Test' })).toThrow();
  });

  it('rejects missing label', () => {
    expect(() => GraphNodeSchema.parse({ id: 'n1' })).toThrow();
  });
});

describe('GraphEdgeSchema', () => {
  it('accepts valid edge', () => {
    expect(GraphEdgeSchema.parse({ id: 'e1', source: 'n1', target: 'n2' })).toEqual({
      id: 'e1', source: 'n1', target: 'n2', label: undefined,
    });
  });

  it('accepts edge with label', () => {
    const edge = GraphEdgeSchema.parse({ id: 'e1', source: 'n1', target: 'n2', label: 'contains' });
    expect(edge.label).toBe('contains');
  });

  it('rejects empty source', () => {
    expect(() => GraphEdgeSchema.parse({ id: 'e1', source: '', target: 'n2' })).toThrow();
  });

  it('rejects empty target', () => {
    expect(() => GraphEdgeSchema.parse({ id: 'e1', source: 'n1', target: '' })).toThrow();
  });
});

describe('GraphSnapshotDataSchema', () => {
  it('accepts valid snapshot data', () => {
    const data = {
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    expect(GraphSnapshotDataSchema.parse(data)).toEqual(data);
  });

  it('accepts empty arrays', () => {
    expect(GraphSnapshotDataSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
  });
});

describe('validateSnapshotData', () => {
  it('returns parsed data for valid input', () => {
    const input = {
      nodes: [{ id: 'n1', label: 'A' }, { id: 'n2', label: 'B' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'link' }],
    };
    expect(validateSnapshotData(input)).toEqual(input);
  });

  it('returns null for invalid input', () => {
    expect(validateSnapshotData({ nodes: 'not-an-array' })).toBeNull();
  });

  it('returns null for missing nodes', () => {
    expect(validateSnapshotData({ edges: [] })).toBeNull();
  });

  it('returns null for node with empty id', () => {
    expect(validateSnapshotData({ nodes: [{ id: '', label: 'X' }], edges: [] })).toBeNull();
  });

  it('returns null for edge with empty source', () => {
    expect(validateSnapshotData({
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [{ id: 'e1', source: '', target: 'n2' }],
    })).toBeNull();
  });

  it('returns null for completely invalid data', () => {
    expect(validateSnapshotData(null)).toBeNull();
    expect(validateSnapshotData(undefined)).toBeNull();
    expect(validateSnapshotData('string')).toBeNull();
    expect(validateSnapshotData(42)).toBeNull();
  });
});
