import type Graph from 'graphology';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { SharedNode, SharedEdge } from '../../store/graph-sync-types';

interface GraphNodeEvent {
  key: string;
  attributes: Record<string, unknown>;
}

interface GraphEdgeEvent {
  key: string;
  source: string;
  target: string;
  attributes: Record<string, unknown>;
}

interface GraphKeyOnlyEvent {
  key: string;
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export function setupGraphSyncListeners(
  graph: Graph
) {
  const store = useGraphSyncStore.getState();

  const onNodeAdded = ({ key, attributes }: GraphNodeEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:add',
      source: 'graph',
      payload: { id: key, label: asString(attributes.label) } satisfies SharedNode,
    });
  };

  const onNodeAttributesUpdated = ({ key, attributes }: GraphNodeEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:update',
      source: 'graph',
      payload: { id: key, label: asString(attributes.label) } satisfies SharedNode,
    });
  };

  const onNodeDropped = ({ key }: GraphKeyOnlyEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'node:remove',
      source: 'graph',
      payload: { id: key, label: '' } satisfies SharedNode,
    });
  };

  const onEdgeAdded = ({ key, source, target, attributes }: GraphEdgeEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'edge:add',
      source: 'graph',
      payload: { id: key, from: source, to: target, label: asString(attributes.label) } satisfies SharedEdge,
    });
  };

  const onEdgeDropped = ({ key }: GraphKeyOnlyEvent) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;
    store.emitEvent({
      type: 'edge:remove',
      source: 'graph',
      payload: { id: key, from: '', to: '' } satisfies SharedEdge,
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
