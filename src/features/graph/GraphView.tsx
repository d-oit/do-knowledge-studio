import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import GraphControls from './GraphControls';
import { jobCoordinator } from '../../lib/jobs';
import { repository } from '../../db/repository';
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
  const graphRef = useRef<Graph>(new Graph());
  const layoutTimeoutRef = useRef<number | null>(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [snapshotData, setSnapshotData] = useState<{ nodes: { id: string; label: string }[]; edges: { id: string; source: string; target: string; label?: string }[] } | null>(null);

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

  const [filteredData, setFilteredData] = useState({ entities, links });

  useEffect(() => {
    if (!focusMode || !selectedNode) {
      setFilteredData({ entities, links });
      return;
    }

    jobCoordinator.enqueue('recompute-neighborhood', selectedNode, {
      entities,
      links,
      selectedNode,
      focusMode
    });
  }, [entities, links, selectedNode, focusMode]);

  useEffect(() => {
    const handler = async (payload: unknown) => {
      const { entities, links, selectedNode } = payload as { entities: Entity[], links: Link[], selectedNode: string };
      const neighborIds = new Set<string>([selectedNode]);
      links.forEach((l: Link) => {
        if (l.source_id === selectedNode) neighborIds.add(l.target_id);
        if (l.target_id === selectedNode) neighborIds.add(l.source_id);
      });

      setFilteredData({
        entities: entities.filter((e: Entity) => neighborIds.has(e.id!)),
        links: links.filter((l: Link) => neighborIds.has(l.source_id) && neighborIds.has(l.target_id))
      });
    };

    jobCoordinator.registerHandler('recompute-neighborhood', handler);
    return () => {
      jobCoordinator.unregisterHandler('recompute-neighborhood');
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = graphRef.current;
    const data = effectiveData;

    // Use requestAnimationFrame for throttling updates
    if (layoutTimeoutRef.current) cancelAnimationFrame(layoutTimeoutRef.current);

    layoutTimeoutRef.current = requestAnimationFrame(() => {
      // Diff and update graph instead of recreating
      const currentNodes = new Set(graph.nodes());
      const targetNodes = new Set(data.entities.map(e => e.id!));

      // 1. Remove nodes that are no longer present
      currentNodes.forEach(nodeId => {
        if (!targetNodes.has(nodeId)) graph.dropNode(nodeId);
      });

      // 2. Add or update nodes
      if (data.entities.length === 0 && !focusMode && !snapshotMode) {
        if (!graph.hasNode('placeholder')) {
           graph.addNode('placeholder', { label: 'Knowledge Studio', size: 10, color: '#2563eb', x: 0, y: 0 });
        }
      } else {
        if (graph.hasNode('placeholder')) graph.dropNode('placeholder');

        data.entities.forEach((e, i) => {
          const nodeColor = snapshotMode ? '#8b5cf6' : (e.id === selectedNode ? '#ef4444' : '#2563eb');
          if (!graph.hasNode(e.id!)) {
            graph.addNode(e.id!, {
              label: e.name,
              size: e.id === selectedNode ? 20 : 10,
              color: nodeColor,
              x: Math.cos((i * 2 * Math.PI) / data.entities.length),
              y: Math.sin((i * 2 * Math.PI) / data.entities.length)
            });
          } else {
            graph.mergeNodeAttributes(e.id!, {
              label: e.name,
              size: e.id === selectedNode ? 20 : 10,
              color: nodeColor,
            });
          }
        });

        // 3. Update edges
        graph.clearEdges();
        data.links.forEach((l) => {
          if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
            graph.mergeEdge(l.source_id, l.target_id, {
              label: l.relation,
              size: 2,
              color: snapshotMode ? '#a78bfa' : '#94a3b8'
            });
          }
        });
      }

      if (!sigmaInstance.current) {
        sigmaInstance.current = new Sigma(graph, containerRef.current!, {
          renderEdgeLabels: true,
          defaultEdgeType: 'arrow',
          labelSize: 12,
          labelWeight: 'bold',
          // Built-in viewport culling is active by default in Sigma v3
          // Level of Detail (LOD) via hideLabelsOnMove
          hideLabelsOnMove: true,
        });

        sigmaInstance.current.on('clickNode', ({ node }) => {
          setSelectedNode(node);
        });

        sigmaInstance.current.on('clickStage', () => {
          setSelectedNode(null);
          setFocusMode(false);
        });
      } else {
        sigmaInstance.current.refresh();
      }
    });

    return () => {
      if (layoutTimeoutRef.current) cancelAnimationFrame(layoutTimeoutRef.current);
    };
  }, [effectiveData, selectedNode, focusMode, snapshotMode, setFocusMode, setSelectedNode]);

  // Cleanup Sigma on unmount
  useEffect(() => {
    return () => {
      sigmaInstance.current?.kill();
      sigmaInstance.current = null;
    };
  }, []);

  const handleSaveSnapshot = async (name: string, nodes: { id: string; label: string }[], edges: { id: string; source: string; target: string; label?: string }[]) => {
    try {
      await repository.createSnapshot(name, nodes, edges);
      logger.info(`Snapshot "${name}" saved successfully`);
    } catch (err) {
      logger.error('Failed to save snapshot', err);
    }
  };

  const handleLoadSnapshot = (nodes: { id: string; label: string }[], edges: { id: string; source: string; target: string; label?: string }[]) => {
    setSnapshotData({ nodes, edges });
    setSnapshotMode(true);
    logger.info(`Snapshot loaded with ${nodes.length} nodes, ${edges.length} edges`);
  };

  const handleExitSnapshot = () => {
    setSnapshotMode(false);
    setSnapshotData(null);
  };

  // Use snapshot data when in snapshot mode, otherwise use filtered live data
  const effectiveData = snapshotMode && snapshotData
    ? { entities: snapshotData.nodes.map(n => ({ id: n.id, name: n.label, type: 'snapshot' } as Entity)), links: snapshotData.edges.map(e => ({ id: e.id, source_id: e.source, target_id: e.target, relation: e.label || '' } as Link)) }
    : filteredData;

  return (
    <div className="graph-container">
      {!hideToolbar && (
        <div className="viz-toolbar">
          {snapshotMode && (
            <div style={{
              padding: '6px 12px',
              background: 'var(--interactive-primary-subtle)',
              borderBottom: '1px solid var(--border-default)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--interactive-primary)',
            }}>
              <span style={{ fontWeight: 600 }}>Snapshot View</span>
              <span style={{ color: 'var(--text-muted)' }}>
                ({snapshotData?.nodes.length ?? 0} nodes, {snapshotData?.edges.length ?? 0} edges)
              </span>
            </div>
          )}
          <GraphControls
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            hasSelection={!!selectedNode}
            selectedName={entities.find(e => e.id === selectedNode)?.name}
            nodes={snapshotMode && snapshotData ? snapshotData.nodes : filteredData.entities.map(e => ({ id: e.id!, label: e.name }))}
            edges={snapshotMode && snapshotData ? snapshotData.edges : filteredData.links.map(l => ({ id: l.id!, source: l.source_id, target: l.target_id, label: l.relation }))}
            onSaveSnapshot={handleSaveSnapshot}
            onLoadSnapshot={handleLoadSnapshot}
            snapshotMode={snapshotMode}
            onSnapshotModeChange={(active) => { if (!active) handleExitSnapshot(); }}
          />
        </div>
      )}
      <div ref={containerRef} className="viz-container" style={{ height: '600px', width: '100%' }} />
    </div>
  );
};

export default GraphView;

