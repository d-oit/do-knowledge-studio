import React, { useEffect, useRef } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';

interface Props {
  entities: Entity[];
  links: Link[];
}

const GraphView: React.FC<Props> = ({ entities, links }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph();

    // Add dummy data if none provided to show visualization works
    if (entities.length === 0) {
      graph.addNode('1', { label: 'Node A', size: 10, color: '#2563eb', x: 0, y: 0 });
      graph.addNode('2', { label: 'Node B', size: 10, color: '#2563eb', x: 1, y: 1 });
      graph.addEdge('1', '2', { label: 'relates to', size: 2 });
    } else {
      entities.forEach((e, i) => {
        graph.addNode(e.id ?? String(i), {
          label: e.name,
          size: 10,
          color: '#2563eb',
          x: Math.random(),
          y: Math.random()
        });
      });
      links.forEach((l) => {
        if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
          graph.addEdge(l.source_id, l.target_id, { label: l.relation });
        }
      });
    }

    sigmaInstance.current = new Sigma(graph, containerRef.current);

    return () => {
      sigmaInstance.current?.kill();
    };
  }, [entities, links]);

  return <div ref={containerRef} className="viz-container" />;
};

export default GraphView;
