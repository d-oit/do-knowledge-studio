import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { setupMindMapSyncListeners } from '../mindmap/sync-adapter';
import { setupGraphSyncListeners } from '../graph/sync-adapter';
import Graph from 'graphology';

// Mock MindElixir as it's hard to render in Vitest/Happy-dom without a real canvas
const mockMindMap = {
  bus: {
    addListener: vi.fn(),
  },
  findEle: vi.fn(),
  addChild: vi.fn(),
  updateNodeStyle: vi.fn(),
  refresh: vi.fn(),
  removeNodes: vi.fn(),
};

interface MindMapOperation {
  name: string;
  obj: { id: string; topic: string };
}

describe('Sync Integration', () => {
  beforeEach(() => {
    useGraphSyncStore.getState().clearEvents();
    useGraphSyncStore.getState().setSyncEnabled(true);
    vi.clearAllMocks();
  });

  it('should sync node addition from mind map to graph', () => {
    const graph = new Graph();
    setupGraphSyncListeners(graph);

    // Simulate setupMindMapSyncListeners
    let mindMapListener: ((op: MindMapOperation) => void) | null = null;
    mockMindMap.bus.addListener.mockImplementation((name: string, cb: (op: MindMapOperation) => void) => {
      if (name === 'operation') mindMapListener = cb;
    });
    setupMindMapSyncListeners(mockMindMap as Parameters<typeof setupMindMapSyncListeners>[0]);

    // 1. Add node in mind map
    act(() => {
      mindMapListener?.({
        name: 'addChild',
        obj: { id: 'test-node', topic: 'Test Node' }
      });
    });

    // Verify event emitted
    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    expect(useGraphSyncStore.getState().pendingEvents[0].type).toBe('node:add');

    // 2. Consume in graph (simulating the effect in GraphView)
    const events = useGraphSyncStore.getState().consumeEvents('graph');
    expect(events).toHaveLength(1);

    act(() => {
      const payload = events[0].payload as { id: string; label: string };
      graph.addNode(payload.id, { label: payload.label });
    });

    expect(graph.hasNode('test-node')).toBe(true);
    expect(graph.getNodeAttribute('test-node', 'label')).toBe('Test Node');
  });

  it('should sync node update from graph to mind map', () => {
    const graph = new Graph();
    setupGraphSyncListeners(graph);

    // 1. Add node in graph
    act(() => {
      graph.addNode('node-1', { label: 'Initial' });
    });

    // Should have emitted node:add
    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    useGraphSyncStore.getState().consumeEvents('mindmap'); // Clear

    // 2. Update node in graph
    act(() => {
      graph.setNodeAttribute('node-1', 'label', 'Updated');
    });

    const events = useGraphSyncStore.getState().pendingEvents;
    expect(events.some(e => e.type === 'node:update')).toBe(true);
    const updateEvent = events.find(e => e.type === 'node:update');
    expect((updateEvent?.payload as { label: string }).label).toBe('Updated');
  });
});
