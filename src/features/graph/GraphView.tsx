import React, { useEffect, useRef, useState, useMemo } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import { Focus } from 'lucide-react';

interface Props {
  entities: Entity[];
  links: Link[];
}

const GraphView: React.FC<Props> = ({ entities, links }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  const filteredData = useMemo(() => {
    if (!focusMode || !selectedNode) {
      return { entities, links };
    }

    const neighborIds = new Set<string>([selectedNode]);
    links.forEach(l => {
      if (l.source_id === selectedNode) neighborIds.add(l.target_id);
      if (l.target_id === selectedNode) neighborIds.add(l.source_id);
    });

    return {
      entities: entities.filter(e => neighborIds.has(e.id!)),
      links: links.filter(l => neighborIds.has(l.source_id) && neighborIds.has(l.target_id))
    };
  }, [entities, links, selectedNode, focusMode]);

  const graph = useMemo(() => new Graph(), []);

  // Initialize Sigma
  useEffect(() => {
    if (!containerRef.current) return;

    if (!sigmaInstance.current) {
      sigmaInstance.current = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: true,
        defaultEdgeType: 'arrow',
        labelRenderedSizeThreshold: 10
      });

      const camera = sigmaInstance.current.getCamera();
      camera.on('updated', () => {
        const ratio = camera.ratio;
        // LOD: Hide edge labels when zoomed out (ratio > 2)
        const shouldRenderEdgeLabels = ratio < 2;
        if (sigmaInstance.current && sigmaInstance.current.getSetting('renderEdgeLabels') !== shouldRenderEdgeLabels) {
          sigmaInstance.current.setSetting('renderEdgeLabels', shouldRenderEdgeLabels);
        }
      });

      sigmaInstance.current.on('clickNode', ({ node }) => {
        setSelectedNode(node);
      });

      sigmaInstance.current.on('clickStage', () => {
        setSelectedNode(null);
        setFocusMode(false);
      });
    }

    return () => {
      if (sigmaInstance.current) {
        sigmaInstance.current.kill();
        sigmaInstance.current = null;
      }
    };
  }, [graph]);

  // Update Graph Data
  useEffect(() => {
    graph.clear();

    if (filteredData.entities.length === 0 && !focusMode) {
      // Show default placeholder if no data
      graph.addNode('1', { label: 'Knowledge Studio', size: 10, color: '#2563eb', x: 0, y: 0 });
    } else {
      filteredData.entities.forEach((e, i) => {
        graph.addNode(e.id ?? String(i), {
          label: e.name,
          size: e.id === selectedNode ? 20 : 10,
          color: e.id === selectedNode ? '#ef4444' : '#2563eb',
          x: Math.cos((i * 2 * Math.PI) / filteredData.entities.length),
          y: Math.sin((i * 2 * Math.PI) / filteredData.entities.length)
        });
      });
      filteredData.links.forEach((l) => {
        if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
          graph.addEdge(l.source_id, l.target_id, {
            label: l.relation,
            size: 2,
            color: '#94a3b8'
          });
        }
      });
    }

    sigmaInstance.current?.refresh();
  }, [graph, filteredData, selectedNode, focusMode]);

  // Handle Resizing
  useEffect(() => {
    if (!containerRef.current || !sigmaInstance.current) return;

    const observer = new ResizeObserver(() => {
      sigmaInstance.current?.refresh();
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="graph-container">
      <div className="viz-toolbar">
        <button
          onClick={() => setFocusMode(!focusMode)}
          className={focusMode ? 'active' : ''}
          disabled={!selectedNode}
          title={!selectedNode ? "Select a node first" : "Toggle Neighborhood Focus"}
        >
          <Focus size={16} /> {focusMode ? 'Show All' : 'Focus Neighborhood'}
        </button>
        {selectedNode && (
          <div className="selection-info">
            Selected: <strong>{entities.find(e => e.id === selectedNode)?.name}</strong>
          </div>
        )}
      </div>
      <div ref={containerRef} className="viz-container" style={{ height: '600px', width: '100%' }} />
    </div>
  );
};

export default GraphView;
