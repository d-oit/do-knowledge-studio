export interface SharedNode {
  id: string;
  label: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface SharedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface GraphSyncEvent {
  type: 'node:add' | 'node:update' | 'node:remove' | 'edge:add' | 'edge:remove';
  source: 'mindmap' | 'graph';
  payload: SharedNode | SharedEdge;
}
