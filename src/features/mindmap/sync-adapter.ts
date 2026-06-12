import type { MindElixirInstance } from 'mind-elixir';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { SharedNode } from '../../store/graph-sync-types';

export function setupMindMapSyncListeners(
  mindMap: MindElixirInstance
) {
  const store = useGraphSyncStore.getState();

  mindMap.bus.addListener('operation', (op: any) => {
    if (!useGraphSyncStore.getState().syncEnabled) return;

    if (op.name === 'addChild' || op.name === 'insertSibling') {
      const obj = op.obj;
      store.emitEvent({
        type: 'node:add',
        source: 'mindmap',
        payload: { id: obj.id, label: obj.topic } as SharedNode,
      });
    }

    if (op.name === 'finishEdit') {
      const obj = op.obj;
      store.emitEvent({
        type: 'node:update',
        source: 'mindmap',
        payload: { id: obj.id, label: obj.topic } as SharedNode,
      });
    }

    if (op.name === 'removeNodes') {
      const objs = op.objs;
      if (Array.isArray(objs)) {
        objs.forEach(obj => {
          store.emitEvent({
            type: 'node:remove',
            source: 'mindmap',
            payload: { id: obj.id, label: '' } as SharedNode,
          });
        });
      }
    }
  });
}
