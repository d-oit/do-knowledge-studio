import React, { useEffect, useRef, useState } from 'react';
import MindElixir, { type Options } from 'mind-elixir';
import { Entity } from '../../lib/validation';
import { jobCoordinator } from '../../lib/jobs';

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
}

const MAX_MINDMAP_NODES = 50;

interface MindMapData {
  id: string;
  topic: string;
  children: { id: string; topic: string }[];
}

const MindMapView: React.FC<Props> = ({ rootEntity, relatedEntities }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [budgetExceeded, setBudgetExceeded] = useState(false);
  const [nodeData, setNodeData] = useState<MindMapData | null>(null);

  useEffect(() => {
    if (!isActive) return;

    setIsComputing(true);
    jobCoordinator.enqueue< { nodeData: MindMapData, budgetExceeded: boolean } >({
      id: `mindmap-prep-${Date.now()}`,
      type: 'mindmap-data-prep',
      payload: { rootEntity, relatedEntities },
      coalesceKey: 'mindmap-prep',
      execute: async (signal) => {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (signal.aborted) throw new Error('AbortError');

        const limitedEntities = relatedEntities.slice(0, MAX_MINDMAP_NODES);
        return {
          nodeData: {
            id: rootEntity.id ?? 'root',
            topic: rootEntity.name,
            children: limitedEntities.map(e => ({
              id: e.id ?? Math.random().toString(),
              topic: e.name
            }))
          },
          budgetExceeded: relatedEntities.length > MAX_MINDMAP_NODES
        };
      },
      onComplete: (result) => {
        setNodeData(result.nodeData);
        setBudgetExceeded(result.budgetExceeded);
        setIsComputing(false);
      },
      onError: () => setIsComputing(false)
    });
  }, [isActive, rootEntity, relatedEntities]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive || !nodeData) return;

    const options: Options = {
      el: container,
      direction: 2, // SIDE
    };

    const mind = new MindElixir(options);
    mind.init({
      nodeData: nodeData
    });

    return () => {
        // MindElixir doesn't have a direct kill() in some versions,
        // but we can clear the container.
        if (container) {
            container.innerHTML = '';
        }
    };
  }, [isActive, nodeData]);

  if (!isActive) {
    return (
      <div className="mindmap-container cold-state" style={{
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: '8px'
      }}>
        <p>Mind Map View is currently inactive to save resources.</p>
        <button className="btn-primary" onClick={() => setIsActive(true)}>
          Activate Mind Map
        </button>
      </div>
    );
  }

  return (
    <div className="mindmap-container">
        <div className="viz-toolbar">
            {isComputing && <span className="status-message">Preparing mind map...</span>}
            {budgetExceeded && <span className="status-message warning">Showing first {MAX_MINDMAP_NODES} related entities.</span>}
        </div>
        <div ref={containerRef} className="viz-container" style={{ height: '600px', width: '100%' }} />
    </div>
  );
};

export default MindMapView;
