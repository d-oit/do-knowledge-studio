import { useEffect } from 'react';
import type Graph from 'graphology';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import type { SharedNode, SharedEdge } from '../../store/graph-sync-types';
import { logger } from '../../lib/logger';

export const useGraphSyncEvents = (graphRef: { current: Graph | null }) => {
  useEffect(() => {
    const unsubscribe = useGraphSyncStore.subscribe((state) => {
      if (!state.syncEnabled || !graphRef.current || state.pendingEvents.length === 0) return;

      const events = useGraphSyncStore.getState().consumeEvents('graph');
      if (events.length === 0) return;

      const graph = graphRef.current;
      events.forEach(event => {
        if (event.type === 'node:add') {
          const payload = event.payload as SharedNode;
          if (!graph.hasNode(payload.id)) {
            graph.addNode(payload.id, {
              label: payload.label,
              size: 10,
              color: '#2563eb',
              x: Math.random(),
              y: Math.random()
            });
          }
        } else if (event.type === 'node:update') {
          const payload = event.payload as SharedNode;
          if (graph.hasNode(payload.id)) {
            const currentLabel = graph.getNodeAttribute(payload.id, 'label') as string;
            if (currentLabel !== payload.label) {
              logger.warn(`[Sync Conflict] Graph node ${payload.id} has different label. Local: ${currentLabel}, Incoming: ${payload.label}. Applying last-writer wins.`);
              graph.mergeNodeAttributes(payload.id, { label: payload.label });
            }
          }
        } else if (event.type === 'node:remove') {
          const payload = event.payload as SharedNode;
          if (graph.hasNode(payload.id)) {
            graph.dropNode(payload.id);
          }
        } else if (event.type === 'edge:add') {
          const payload = event.payload as SharedEdge;
          if (graph.hasNode(payload.from) && graph.hasNode(payload.to) && !graph.hasEdge(payload.id)) {
            graph.addEdgeWithKey(payload.id, payload.from, payload.to, {
              label: payload.label,
              size: 2,
              color: '#94a3b8'
            });
          }
        } else if (event.type === 'edge:remove') {
          const payload = event.payload as SharedEdge;
          if (graph.hasEdge(payload.id)) {
            graph.dropEdge(payload.id);
          }
        }
      });
    });
    return () => unsubscribe();
  }, [graphRef]);
};
