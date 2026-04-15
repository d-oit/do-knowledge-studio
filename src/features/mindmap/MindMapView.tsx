import React, { useEffect, useRef } from 'react';
import MindElixir from 'mind-elixir';
import { Entity } from '../../lib/validation';

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
}

const MindMapView: React.FC<Props> = ({ rootEntity, relatedEntities }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const mind = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      data: {
        nodeData: {
          id: rootEntity.id ?? 'root',
          topic: rootEntity.name,
          root: true,
          children: relatedEntities.map(e => ({
            id: e.id ?? Math.random().toString(),
            topic: e.name
          }))
        }
      }
    });

    mind.init();
  }, [rootEntity, relatedEntities]);

  return <div ref={containerRef} className="viz-container" />;
};

export default MindMapView;
