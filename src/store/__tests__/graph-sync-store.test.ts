import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphSyncStore } from '../graph-sync-store';
import { GraphSyncEvent } from '../graph-sync-types';

describe('GraphSyncStore', () => {
  beforeEach(() => {
    useGraphSyncStore.getState().clearEvents();
    useGraphSyncStore.getState().setSyncEnabled(false);
  });

  it('should toggle syncEnabled', () => {
    const store = useGraphSyncStore.getState();
    expect(store.syncEnabled).toBe(false);
    store.setSyncEnabled(true);
    expect(useGraphSyncStore.getState().syncEnabled).toBe(true);
  });

  it('should emit events', () => {
    const store = useGraphSyncStore.getState();
    const event: GraphSyncEvent = {
      type: 'node:add',
      source: 'mindmap',
      payload: { id: '1', label: 'Test' },
    };
    store.emitEvent(event);
    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    expect(useGraphSyncStore.getState().pendingEvents[0]).toEqual(event);
  });

  it('should consume events for a target and filter out source', () => {
    const store = useGraphSyncStore.getState();
    const event1: GraphSyncEvent = {
      type: 'node:add',
      source: 'mindmap',
      payload: { id: '1', label: 'From Mindmap' },
    };
    const event2: GraphSyncEvent = {
      type: 'node:add',
      source: 'graph',
      payload: { id: '2', label: 'From Graph' },
    };

    store.emitEvent(event1);
    store.emitEvent(event2);

    // Graph consumes: should get event1 (from mindmap), keep event2 (from graph)
    const graphEvents = store.consumeEvents('graph');
    expect(graphEvents).toHaveLength(1);
    expect(graphEvents[0]).toEqual(event1);
    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(1);
    expect(useGraphSyncStore.getState().pendingEvents[0]).toEqual(event2);

    // Mindmap consumes: should get event2, keep nothing
    const mindmapEvents = store.consumeEvents('mindmap');
    expect(mindmapEvents).toHaveLength(1);
    expect(mindmapEvents[0]).toEqual(event2);
    expect(useGraphSyncStore.getState().pendingEvents).toHaveLength(0);
  });
});
