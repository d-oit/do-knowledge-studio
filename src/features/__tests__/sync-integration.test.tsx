import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { setupMindMapSyncListeners } from '../mindmap/sync-adapter';
import { setupGraphSyncListeners } from '../graph/sync-adapter';
import Graph from 'graphology';

interface MockMindMapOperation {
  name: string;
  obj?: { id?: string; topic?: string };
}

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

describe('Sync Integration', () => {
  beforeEach(() => {
    useGraphSyncStore.getState().clearEvents();
    useGraphSyncStore.getState().setSyncEnabled(true);
    vi.clearAllMocks();
  });

  it('should sync node addition from mind map to graph', () => {
    const graph = new Graph();
    setupGraphSyncListeners(graph);

    let mindMapListener: (op: MockMindMapOperation) => void = () => { /* noop */ };
    mockMindMap.bus.addListener.mockImplementation((_name: string, cb: (op: MockMindMapOperation) => void) => {
      mindMapListener = cb;
    });
    setupMindMapSyncListeners(mockMindMap as unknown as Parameters<typeof setupMindMapSyncListeners>[0]);

    act(() => {
      mindMapListener({
        name: 'addChild',
        obj: { id: 'test-node', topic: 'Test Node' }
      });
    });

    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    expect(useGraphSyncStore.getState().pendingEvents[0].type).toBe('node:add');

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

    act(() => {
      graph.addNode('node-1', { label: 'Initial' });
    });

    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    useGraphSyncStore.getState().consumeEvents('mindmap');

    act(() => {
      graph.setNodeAttribute('node-1', 'label', 'Updated');
    });

    const events = useGraphSyncStore.getState().pendingEvents;
    expect(events.some(e => e.type === 'node:update')).toBe(true);
    const updateEvent = events.find(e => e.type === 'node:update');
    const payload = updateEvent?.payload as { label: string };
    expect(payload.label).toBe('Updated');
  });
});
