import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import { GraphControls } from './GraphControls';

interface Props {
  entities: Entity[];
  links: Link[];
  focusMode?: boolean;
  onFocusModeChange?: (focus: boolean) => void;
  selectedNode?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  hideToolbar?: boolean;
}

const GraphView: React.FC<Props> = ({
  entities,
  links,
  focusMode: propsFocusMode,
  onFocusModeChange,
  selectedNode: propsSelectedNode,
  onSelectedNodeChange,
  hideToolbar
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);

  const selectedNode = propsSelectedNode !== undefined ? propsSelectedNode : internalSelectedNode;
  const focusMode = propsFocusMode !== undefined ? propsFocusMode : internalFocusMode;

  const setSelectedNode = useCallback((node: string | null) => {
    if (onSelectedNodeChange) onSelectedNodeChange(node);
    else setInternalSelectedNode(node);
  }, [onSelectedNodeChange]);

  const setFocusMode = useCallback((focus: boolean) => {
    if (onFocusModeChange) onFocusModeChange(focus);
    else setInternalFocusMode(focus);
  }, [onFocusModeChange]);

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

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph();

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

    if (sigmaInstance.current) {
        sigmaInstance.current.kill();
    }

    sigmaInstance.current = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: true,
      defaultEdgeType: 'arrow'
    });

    sigmaInstance.current.on('clickNode', ({ node }) => {
      setSelectedNode(node);
    });

    sigmaInstance.current.on('clickStage', () => {
      setSelectedNode(null);
      setFocusMode(false);
    });

    return () => {
      sigmaInstance.current?.kill();
      sigmaInstance.current = null;
    };
  }, [filteredData, selectedNode, focusMode, setFocusMode, setSelectedNode]);

  return (
    <div className="graph-container">
      {!hideToolbar && (
        <div className="viz-toolbar">
          <GraphControls
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            hasSelection={!!selectedNode}
            selectedName={entities.find(e => e.id === selectedNode)?.name}
          />
        </div>
      )}
      <div ref={containerRef} className="viz-container" style={{ height: '600px', width: '100%' }} />
    </div>
  );
};

export default GraphView;
