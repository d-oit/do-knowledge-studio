import React, { useEffect, useRef } from 'react';
import MindElixir, { type Options } from 'mind-elixir';
import { Entity } from '../../lib/validation';

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
}

const MindMapView: React.FC<Props> = ({ rootEntity, relatedEntities }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const options: Options = {
      el: containerRef.current,
      direction: 2, // SIDE
    };

    const mind = new MindElixir(options);

    mind.init({
      nodeData: {
        id: rootEntity.id ?? 'root',
        topic: rootEntity.name,
        // root: true, // Type definition might not include this in some versions
        children: relatedEntities.map(e => ({
          id: e.id ?? Math.random().toString(),
          topic: e.name
        }))
      }
    });
  }, [rootEntity, relatedEntities]);

  return <div ref={containerRef} className="viz-container" />;
};

export default MindMapView;
