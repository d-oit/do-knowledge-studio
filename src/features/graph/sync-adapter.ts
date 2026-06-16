import type Graph from 'graphology';
import { useGraphSyncStore } from '../../store/graph-sync-store';

interface GraphEvent {
  key: string;
  attributes?: { label?: string };
  source?: string;
  target?: string;
}

export function setupGraphSyncListeners(
  graph: Graph
) {
  const store = useGraphSyncStore.getState();

  const onNodeAdded = ({ key, attributes }: GraphEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:add',
      source: 'graph',
      payload: { id: key, label: attributes?.label ?? '' },
    });
  };

  const onNodeAttributesUpdated = ({ key, attributes }: GraphEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:update',
      source: 'graph',
      payload: { id: key, label: attributes?.label ?? '' },
    });
  };

  const onNodeDropped = ({ key }: GraphEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:remove',
      source: 'graph',
      payload: { id: key, label: '' },
    });
  };

  const onEdgeAdded = ({ key, source, target, attributes }: GraphEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'edge:add',
      source: 'graph',
      payload: { id: key, from: source ?? '', to: target ?? '', label: attributes?.label ?? '' },
    });
  };

  const onEdgeDropped = ({ key }: GraphEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    // We don't have from/to here, but id should be enough for removal if shared
    store.emitEvent({
      type: 'edge:remove',
      source: 'graph',
      payload: { id: key, from: '', to: '' },
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
