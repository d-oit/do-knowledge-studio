import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import GraphControls from './GraphControls';
import { jobCoordinator } from '../../lib/jobs';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';

/** Tracks current touch state for mobile gesture handling. */
interface TouchState {
  touches: Map<number, { x: number; y: number }>;
  initialPinchDistance: number;
  initialCameraRatio: number;
  initialCameraX: number;
  initialCameraY: number;
  isPanning: boolean;
  isPinching: boolean;
  lastPanX: number;
  lastPanY: number;
}

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
    perf.mark('graph-view-mount');

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
          hideLabelsOnMove: true,
        });

        sigmaInstance.current.on('clickNode', ({ node }) => {
          setSelectedNode(node);
        });

        sigmaInstance.current.on('clickStage', () => {
          setSelectedNode(null);
          setFocusMode(false);
        });

        perf.measure('graph-layout-finish', 'graph-view-mount');
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

  // --- Mobile touch gesture handling (pinch-to-zoom + drag-to-pan) ---
  const touchStateRef = useRef<TouchState>({
    touches: new Map(),
    initialPinchDistance: 0,
    initialCameraRatio: 1,
    initialCameraX: 0,
    initialCameraY: 0,
    isPanning: false,
    isPinching: false,
    lastPanX: 0,
    lastPanY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchDistance = (t1: Touch, t2: Touch): number =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const onTouchStart = (e: TouchEvent) => {
      const sigma = sigmaInstance.current;
      if (!sigma) return;

      const state = touchStateRef.current;
      state.touches.clear();

      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        state.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (e.touches.length === 1) {
        state.isPanning = true;
        state.isPinching = false;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        state.isPinching = true;
        state.isPanning = false;
        const camera = sigma.getCamera();
        state.initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        state.initialCameraRatio = camera.ratio;
        state.initialCameraX = camera.x;
        state.initialCameraY = camera.y;
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const sigma = sigmaInstance.current;
      if (!sigma) return;

      const state = touchStateRef.current;

      if (state.isPinching && e.touches.length >= 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = state.initialPinchDistance > 0
          ? currentDistance / state.initialPinchDistance
          : 1;
        const newRatio = Math.max(0.1, Math.min(10, state.initialCameraRatio / scale));

        const camera = sigma.getCamera();
        camera.setState({
          ratio: newRatio,
          x: state.initialCameraX,
          y: state.initialCameraY,
        });
      } else if (state.isPanning && e.touches.length === 1) {
        const dx = e.touches[0].clientX - state.lastPanX;
        const dy = e.touches[0].clientY - state.lastPanY;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;

        const camera = sigma.getCamera();
        camera.setState({
          x: camera.x + dx / camera.ratio,
          y: camera.y + dy / camera.ratio,
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;
      // Remove ended touches
      for (let i = 0; i < e.changedTouches.length; i++) {
        state.touches.delete(e.changedTouches[i].identifier);
      }

      if (e.touches.length === 0) {
        state.isPanning = false;
        state.isPinching = false;
      } else if (e.touches.length === 1 && state.isPinching) {
        // Transition from pinch to pan
        state.isPinching = false;
        state.isPanning = true;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

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

