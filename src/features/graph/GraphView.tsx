import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import { GraphControls } from './GraphControls';
import { jobCoordinator } from '../../lib/jobs';
import { logger } from '../../lib/logger';

interface Props {
  entities: Entity[];
  links: Link[];
  focusMode?: boolean;
  onFocusModeChange?: (focus: boolean) => void;
  selectedNode?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  hideToolbar?: boolean;
}

const MAX_NODES = 200;
const MAX_EDGES = 500;

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
  const [isActive, setIsActive] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [budgetExceeded, setBudgetExceeded] = useState(false);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);

  const selectedNode = propsSelectedNode !== undefined ? propsSelectedNode : internalSelectedNode;
  const focusMode = propsFocusMode !== undefined ? propsFocusMode : internalFocusMode;

  const [filteredData, setFilteredData] = useState<{ entities: Entity[]; links: Link[] }>({ entities: [], links: [] });

  const setSelectedNode = useCallback((node: string | null) => {
    if (onSelectedNodeChange) onSelectedNodeChange(node);
    else setInternalSelectedNode(node);
  }, [onSelectedNodeChange]);

  const setFocusMode = useCallback((focus: boolean) => {
    if (onFocusModeChange) onFocusModeChange(focus);
    else setInternalFocusMode(focus);
  }, [onFocusModeChange]);

  // Offload neighborhood computation to JobCoordinator
  useEffect(() => {
    if (!isActive) return;

    setIsComputing(true);
    jobCoordinator.enqueue({
      id: `graph-recompute-${Date.now()}`,
      type: 'recompute-neighborhood',
      payload: { entities, links, selectedNode, focusMode },
      coalesceKey: 'graph-recompute',
      execute: async (signal) => {
        // Simulate some work or just yield to main thread
        await new Promise(resolve => setTimeout(resolve, 0));

        if (signal.aborted) throw new Error('AbortError');

        let resultEntities = entities;
        let resultLinks = links;

        if (focusMode && selectedNode) {
          const neighborIds = new Set<string>([selectedNode]);
          links.forEach(l => {
            if (l.source_id === selectedNode) neighborIds.add(l.target_id);
            if (l.target_id === selectedNode) neighborIds.add(l.source_id);
          });

          resultEntities = entities.filter(e => neighborIds.has(e.id!));
          resultLinks = links.filter(l => neighborIds.has(l.source_id) && neighborIds.has(l.target_id));
        }

        const isExceeded = resultEntities.length > MAX_NODES || resultLinks.length > MAX_EDGES;

        // Ensure selectedNode is always included if it exists in original data
        let finalEntities = resultEntities.slice(0, MAX_NODES);
        if (selectedNode && !finalEntities.find(e => e.id === selectedNode)) {
            const selected = resultEntities.find(e => e.id === selectedNode);
            if (selected) {
                finalEntities = [selected, ...resultEntities.filter(e => e.id !== selectedNode).slice(0, MAX_NODES - 1)];
            }
        }

        return {
          entities: finalEntities,
          links: resultLinks.slice(0, MAX_EDGES),
          budgetExceeded: isExceeded,
          totalNodes: resultEntities.length,
          totalEdges: resultLinks.length
        };
      },
      onComplete: (result) => {
        setFilteredData({ entities: result.entities, links: result.links });
        setBudgetExceeded(result.budgetExceeded);
        setStats({ nodes: result.totalNodes, edges: result.totalEdges });
        setIsComputing(false);
      },
      onError: (err) => {
        logger.error('Graph computation failed', err);
        setIsComputing(false);
      }
    });
  }, [isActive, entities, links, selectedNode, focusMode]);

  useEffect(() => {
    if (!containerRef.current || !isActive) return;

    const graph = new Graph();

    if (filteredData.entities.length === 0 && !focusMode) {
      // Show default placeholder if no data
      graph.addNode('1', { label: 'Knowledge Studio', size: 10, color: '#2563eb', x: 0, y: 0 });
    } else {
      filteredData.entities.forEach((e, i) => {
        if (!graph.hasNode(e.id!)) {
            graph.addNode(e.id ?? String(i), {
              label: e.name,
              size: e.id === selectedNode ? 20 : 10,
              color: e.id === selectedNode ? '#ef4444' : '#2563eb',
              x: Math.cos((i * 2 * Math.PI) / filteredData.entities.length),
              y: Math.sin((i * 2 * Math.PI) / filteredData.entities.length)
            });
        }
      });
      filteredData.links.forEach((l) => {
        if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
          graph.mergeEdge(l.source_id, l.target_id, {
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
  }, [isActive, filteredData, selectedNode, focusMode, setFocusMode, setSelectedNode]);

  if (!isActive) {
    return (
      <div className="graph-container cold-state" style={{
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: '8px'
      }}>
        <p>Knowledge Graph is currently inactive to save resources.</p>
        <button className="btn-primary" onClick={() => setIsActive(true)}>
          Activate Graph View
        </button>
      </div>
    );
  }

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
          {isComputing && <span className="status-message">Updating graph...</span>}
          {budgetExceeded && (
            <span className="status-message warning">
              Budget exceeded ({stats.nodes} nodes, {stats.edges} edges). Partial view.
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} className="viz-container" style={{ height: '600px', width: '100%' }} />
    </div>
  );
};

export default GraphView;
