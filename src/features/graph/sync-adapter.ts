import type Graph from 'graphology';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { SharedNode, SharedEdge } from '../../store/graph-sync-types';

export function setupGraphSyncListeners(
  graph: Graph
) {
  const store = useGraphSyncStore.getState();

  const onNodeAdded = ({ key, attributes }: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:add',
      source: 'graph',
      payload: { id: key, label: attributes.label } as SharedNode,
    });
  };

  const onNodeAttributesUpdated = ({ key, attributes }: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:update',
      source: 'graph',
      payload: { id: key, label: attributes.label } as SharedNode,
    });
  };

  const onNodeDropped = ({ key }: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:remove',
      source: 'graph',
      payload: { id: key, label: '' } as SharedNode,
    });
  };

  const onEdgeAdded = ({ key, source, target, attributes }: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'edge:add',
      source: 'graph',
      payload: { id: key, from: source, to: target, label: attributes.label } as SharedEdge,
    });
  };

  const onEdgeDropped = ({ key }: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    // We don't have from/to here, but id should be enough for removal if shared
    store.emitEvent({
      type: 'edge:remove',
      source: 'graph',
      payload: { id: key, from: '', to: '' } as SharedEdge,
    });
  };

  graph.on('nodeAdded', onNodeAdded);
  graph.on('nodeAttributesUpdated', onNodeAttributesUpdated);
  graph.on('nodeDropped', onNodeDropped);
  graph.on('edgeAdded', onEdgeAdded);
  graph.on('edgeDropped', onEdgeDropped);

  return () => {
    graph.off('nodeAdded', onNodeAdded);
    graph.off('nodeAttributesUpdated', onNodeAttributesUpdated);
    graph.off('nodeDropped', onNodeDropped);
    graph.off('edgeAdded', onEdgeAdded);
    graph.off('edgeDropped', onEdgeDropped);
  };
}
