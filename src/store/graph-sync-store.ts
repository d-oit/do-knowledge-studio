import { create } from 'zustand';
import type { GraphSyncEvent } from './graph-sync-types';

interface GraphSyncStore {
  syncEnabled: boolean;
  setSyncEnabled: (v: boolean) => void;
  pendingEvents: GraphSyncEvent[];
  emitEvent: (event: GraphSyncEvent) => void;
  consumeEvents: (target: 'mindmap' | 'graph') => GraphSyncEvent[];
  clearEvents: () => void;
}

export const useGraphSyncStore = create<GraphSyncStore>((set, get) => ({
  syncEnabled: false,
  setSyncEnabled: (v) => set({ syncEnabled: v }),
  pendingEvents: [],
  emitEvent: (event) =>
    set(s => ({ pendingEvents: [...s.pendingEvents, event] })),
  consumeEvents: (target) => {
    const allEvents = get().pendingEvents;
    const eventsForTarget = allEvents.filter(e => e.source !== target);
    const remainingEvents = allEvents.filter(e => e.source === target);
    set({ pendingEvents: remainingEvents });
    return eventsForTarget;
  },
  clearEvents: () => set({ pendingEvents: [] }),
}));
