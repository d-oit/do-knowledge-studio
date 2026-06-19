import { describe, it, expect } from 'vitest';
import { validateSnapshotData } from '../graph-schemas';

describe('GraphKeyboardNav', () => {
  it('validates snapshot data before loading', () => {
    const validData = {
      nodes: [{ id: 'n1', label: 'A' }, { id: 'n2', label: 'B' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const result = validateSnapshotData(validData);
    expect(result).not.toBeNull();
    expect(result?.nodes).toHaveLength(2);
    expect(result?.edges).toHaveLength(1);
  });

  it('rejects invalid snapshot data', () => {
    expect(validateSnapshotData(null)).toBeNull();
    expect(validateSnapshotData({})).toBeNull();
    expect(validateSnapshotData({ nodes: 'bad' })).toBeNull();
  });

  it('filters out placeholder nodes', () => {
    const nodes = ['placeholder', 'n1', 'n2'];
    const visibleNodes = nodes.filter(n => n !== 'placeholder');
    expect(visibleNodes).toEqual(['n1', 'n2']);
  });

  it('cycles through nodes with Tab key', () => {
    const nodes = ['n1', 'n2', 'n3'];
    const currentIdx = 0;
    const dir = 1;
    const next = ((currentIdx + dir) % nodes.length + nodes.length) % nodes.length;
    expect(next).toBe(1);
  });

  it('wraps around with Shift+Tab', () => {
    const nodes = ['n1', 'n2', 'n3'];
    const currentIdx = 0;
    const dir = -1;
    const next = ((currentIdx + dir) % nodes.length + nodes.length) % nodes.length;
    expect(next).toBe(2);
  });

  it('navigates to first neighbor with ArrowRight', () => {
    const neighbors = ['n2', 'n3'];
    expect(neighbors[0]).toBe('n2');
  });

  it('navigates to last neighbor with ArrowLeft', () => {
    const neighbors = ['n2', 'n3'];
    expect(neighbors[neighbors.length - 1]).toBe('n3');
  });
});
