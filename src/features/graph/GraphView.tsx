import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import type { NodeDisplayData, EdgeDisplayData } from 'sigma/types';
import { Entity, Link, Claim } from '../../lib/validation';
import GraphControls from './GraphControls';
import GraphInspector from './GraphInspector';
import { jobCoordinator } from '../../lib/jobs';
import { repository } from '../../db/repository';
import { removeFromSearchIndex } from '../../lib/search';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { assign as assignFA2Layout, inferSettings } from 'graphology-layout-forceatlas2';

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

type LayoutType = 'circular' | 'force' | 'hierarchical';

interface Props {
  entities: Entity[];
  links: Link[];
  focusMode?: boolean;
  onFocusModeChange?: (focus: boolean) => void;
  selectedNode?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  hideToolbar?: boolean;
  onEditEntity?: (entityId: string) => void;
}

const GraphView: React.FC<Props> = ({
  entities,
  links,
  focusMode: propsFocusMode,
  onFocusModeChange,
  selectedNode: propsSelectedNode,
  onSelectedNodeChange,
  hideToolbar,
  onEditEntity,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph>(new Graph());
  const layoutTimeoutRef = useRef<number | null>(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [snapshotData, setSnapshotData] = useState<{ nodes: { id: string; label: string }[]; edges: { id: string; source: string; target: string; label?: string }[] } | null>(null);
  const [selectedEntityClaims, setSelectedEntityClaims] = useState<Claim[]>([]);
  const [selectedEntityLinks, setSelectedEntityLinks] = useState<Link[]>([]);

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
  const [layout, setLayout] = useState<LayoutType>('force');
  const [focusRingIndex, setFocusRingIndex] = useState<number>(-1);

  const cameraRatioRef = useRef(1);
  const graphSize = useMemo(() => {
    const count = entities.length;
    if (count <= 30) return 'small' as const;
    if (count <= 100) return 'medium' as const;
    if (count <= 500) return 'large' as const;
    return 'xlarge' as const;
  }, [entities.length]);

  // Cheaper layout for very large graphs: skip labels at medium zoom, simpler edges
  const layoutSettings = useMemo(() => ({
    renderEdgeLabels: graphSize === 'small',
    defaultEdgeType: graphSize === 'xlarge' ? 'line' as const : 'arrow' as const,
    labelSize: graphSize === 'large' ? 10 : graphSize === 'xlarge' ? 8 : 12,
    labelWeight: 'bold' as const,
    hideLabelsOnMove: true,
    labelRenderedSizeThreshold: graphSize === 'large' ? 8 : graphSize === 'xlarge' ? 10 : 6,
    defaultEdgeColor: '#94a3b8',
  }), [graphSize]);

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

  // Apply hierarchical layout to the graph
  const applyHierarchicalLayout = useCallback((graph: Graph, nodes: Entity[]) => {
    // Compute ranks based on link direction
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    nodes.forEach(n => { inDegree.set(n.id!, 0); outDegree.set(n.id!, 0); });
    links.forEach(l => {
      if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
        outDegree.set(l.source_id, (outDegree.get(l.source_id) || 0) + 1);
        inDegree.set(l.target_id, (inDegree.get(l.target_id) || 0) + 1);
      }
    });

    // BFS from root nodes (nodes with no incoming links)
    const visited = new Set<string>();
    const levels = new Map<string, number>();
    const queue: string[] = [];

    nodes.forEach(n => {
      if ((inDegree.get(n.id!) || 0) === 0) {
        queue.push(n.id!);
        levels.set(n.id!, 0);
      }
    });

    // Fallback: if no root nodes, use node with most outgoing links
    if (queue.length === 0 && nodes.length > 0) {
      let maxOut = -1;
      let bestNode = nodes[0].id!;
      nodes.forEach(n => {
        const out = outDegree.get(n.id!) || 0;
        if (out > maxOut) { maxOut = out; bestNode = n.id!; }
      });
      queue.push(bestNode);
      levels.set(bestNode, 0);
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const currentLevel = levels.get(currentId) || 0;
      links.forEach(l => {
        if (l.source_id === currentId && !visited.has(l.target_id) && graph.hasNode(l.target_id)) {
          levels.set(l.target_id, currentLevel + 1);
          queue.push(l.target_id);
        }
      });
    }

    // Assign positions based on level and rank within level
    const levelBuckets = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelBuckets.has(level)) levelBuckets.set(level, []);
      levelBuckets.get(level)!.push(nodeId);
    });

    const levelSpacing = 300;
    const nodeSpacing = 120;
    levelBuckets.forEach((nodeIds, level) => {
      const totalWidth = (nodeIds.length - 1) * nodeSpacing;
      nodeIds.forEach((nodeId, idx) => {
        const x = level * levelSpacing - 500;
        const y = idx * nodeSpacing - totalWidth / 2;
        graph.setNodeAttribute(nodeId, 'x', x);
        graph.setNodeAttribute(nodeId, 'y', y + 100);
      });
    });
  }, [links]);

  const applyCircularLayout = useCallback((graph: Graph, nodes: { id: string }[]) => {
    const n = nodes.length;
    if (n === 0) return;
    const radius = Math.max(200, n * 30);
    nodes.forEach((node, i) => {
      const angle = (i * 2 * Math.PI) / n;
      graph.setNodeAttribute(node.id, 'x', Math.cos(angle) * radius);
      graph.setNodeAttribute(node.id, 'y', Math.sin(angle) * radius);
    });
  }, []);

  const applyForceLayout = useCallback((graph: Graph) => {
    if (graph.order === 0) return;
    const settings = inferSettings(graph);
    assignFA2Layout(graph, { settings, iterations: 100 });
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

        // 3. Diff and update edges instead of clear/re-add
        const targetEdgeSet = new Set<string>();
        data.links.forEach((l) => {
          targetEdgeSet.add(`${l.source_id}|${l.target_id}`);
        });

        graph.edges().forEach((edge) => {
          const s = graph.source(edge);
          const t = graph.target(edge);
          if (!targetEdgeSet.has(`${s}|${t}`)) {
            graph.dropEdge(edge);
          }
        });

        data.links.forEach((l) => {
          if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
            graph.mergeEdge(l.source_id, l.target_id, {
              label: l.relation,
              size: 2,
              color: snapshotMode ? '#a78bfa' : '#94a3b8'
            });
          }
        });

        // Apply layout
        if (layout === 'hierarchical') {
          applyHierarchicalLayout(graph, data.entities);
        } else if (layout === 'force') {
          applyForceLayout(graph);
        }
      }

      if (!sigmaInstance.current) {
        sigmaInstance.current = new Sigma(graph, containerRef.current!, {
          ...layoutSettings,
          nodeReducer: (node, data) => {
            const ratio = cameraRatioRef.current;
            const result: Partial<NodeDisplayData> = { ...data };
            if (ratio > 1.5) {
              result.label = data.label;
              result.size = (data.size || 10) * Math.min(ratio, 3);
            } else if (ratio < 0.5) {
              result.label = '';
              result.size = Math.max((data.size || 10) * 0.5, 2);
            } else if (ratio < 0.8 && (graphSize === 'large' || graphSize === 'xlarge')) {
              result.label = '';
              result.size = (data.size || 10) * 0.7;
            } else if (ratio < 1.0 && graphSize === 'xlarge') {
              result.label = '';
              result.size = (data.size || 10) * 0.85;
            }
            const g = graphRef.current;
            if (g && g.getNodeAttribute(node, 'fixed')) {
              result.color = '#7c3aed';
            }
            return result;
          },
          edgeReducer: (edge, data) => {
            const ratio = cameraRatioRef.current;
            const result: Partial<EdgeDisplayData> = { ...data };
            if (ratio < 0.5) {
              result.label = '';
              result.hidden = true;
            } else if (ratio < 0.8 && graphSize === 'large') {
              result.label = '';
              result.size = Math.min(data.size || 1, 0.5);
            } else if (ratio < 1.0 && graphSize === 'xlarge') {
              result.label = '';
              result.hidden = true;
            }
            return result;
          },
        });

        sigmaInstance.current.on('clickNode', ({ node }) => {
          setSelectedNode(node);
        });

        sigmaInstance.current.on('clickStage', () => {
          setSelectedNode(null);
          setFocusMode(false);
        });

        sigmaInstance.current.on('rightClickNode', ({ node }) => {
          const graph = graphRef.current;
          const currentFixed = graph.getNodeAttribute(node, 'fixed') || false;
          graph.setNodeAttribute(node, 'fixed', !currentFixed);
          sigmaInstance.current?.refresh();
        });

        sigmaInstance.current.on('cameraUpdated', () => {
          const camera = sigmaInstance.current?.getCamera();
          if (camera) {
            cameraRatioRef.current = camera.ratio;
          }
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

  // Fetch claims and links when selected node changes
  useEffect(() => {
    if (!selectedNode) {
      setSelectedEntityClaims([]);
      setSelectedEntityLinks([]);
      return;
    }
    repository.getClaimsByEntityId(selectedNode).then(claims => {
      setSelectedEntityClaims(claims);
    }).catch(err => logger.error('Failed to fetch entity claims', err));
    setSelectedEntityLinks(links.filter(l => l.source_id === selectedNode || l.target_id === selectedNode));
  }, [selectedNode, links]);

  // Re-layout when layout mode changes (without full re-render)
  useEffect(() => {
    const graph = graphRef.current;
    const sigma = sigmaInstance.current;
    if (!graph || !sigma || effectiveData.entities.length === 0) return;

    switch (layout) {
      case 'circular':
        applyCircularLayout(graph, effectiveData.entities);
        break;
      case 'force':
        applyForceLayout(graph);
        break;
      case 'hierarchical':
        applyHierarchicalLayout(graph, effectiveData.entities);
        break;
    }
    sigma.refresh();
    sigma.getCamera().animatedReset({ duration: 400 });
  }, [layout, effectiveData.entities, applyHierarchicalLayout, applyCircularLayout, applyForceLayout]);

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

  const handleExportPNG = useCallback(() => {
    const sigma = sigmaInstance.current;
    if (!sigma) return;
    const canvases = sigma.getCanvases();
    const canvas = Object.values(canvases)[0];
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `graph-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    logger.info('Graph exported as PNG');
  }, []);

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

  // --- Keyboard navigation ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const sigma = sigmaInstance.current;
      if (!sigma) return;

      const graph = graphRef.current;
      const nodes = graph.nodes();
      const visibleNodes = nodes.filter(n => n !== 'placeholder');
      const currentIdx = selectedNode ? visibleNodes.indexOf(selectedNode) : focusRingIndex;

      // Arrow keys with modifier = pan camera
      const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
          if (visibleNodes[next]) {
            setSelectedNode(visibleNodes[next]);
            setFocusRingIndex(next);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigma.getCamera();
            camera.setState({ x: camera.x + 50 / camera.ratio });
          } else if (selectedNode) {
            // Navigate to nearest neighbor in the left/up direction (prefer source nodes)
            const neighbors = graph.neighbors(selectedNode);
            if (neighbors.length > 0) {
              setSelectedNode(neighbors[neighbors.length - 1]);
            }
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigma.getCamera();
            camera.setState({ x: camera.x - 50 / camera.ratio });
          } else if (selectedNode) {
            // Navigate to nearest neighbor in the right/down direction (prefer target nodes)
            const neighbors = graph.neighbors(selectedNode);
            if (neighbors.length > 0) {
              setSelectedNode(neighbors[0]);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigma.getCamera();
            camera.setState({ y: camera.y + 50 / camera.ratio });
          } else if (visibleNodes.length > 0) {
            // Previous node in list
            const dir = -1;
            const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
            if (visibleNodes[next]) {
              setSelectedNode(visibleNodes[next]);
              setFocusRingIndex(next);
            }
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigma.getCamera();
            camera.setState({ y: camera.y - 50 / camera.ratio });
          } else if (visibleNodes.length > 0) {
            // Next node in list
            const dir = 1;
            const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
            if (visibleNodes[next]) {
              setSelectedNode(visibleNodes[next]);
              setFocusRingIndex(next);
            }
          }
          break;
        }
        case '=':
        case '+': {
          e.preventDefault();
          const camera = sigma.getCamera();
          camera.setState({ ratio: camera.ratio * 0.8 });
          break;
        }
        case '-': {
          e.preventDefault();
          const camera = sigma.getCamera();
          camera.setState({ ratio: camera.ratio / 0.8 });
          break;
        }
        case 'Home': {
          e.preventDefault();
          sigma.getCamera().animatedReset({ duration: 300 });
          break;
        }
        case 'Enter':
        case ' ': {
          if (visibleNodes.length > 0 && currentIdx >= 0 && visibleNodes[currentIdx]) {
            setSelectedNode(visibleNodes[currentIdx]);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedNode(null);
          setFocusRingIndex(-1);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (selectedNode && window.confirm(`Delete "${entities.find(e => e.id === selectedNode)?.name}"? This will also delete all claims and links for this entity.`)) {
            void repository.deleteEntity(selectedNode).then(() => {
              void removeFromSearchIndex(selectedNode);
              logger.info('Entity deleted via keyboard', { id: selectedNode });
              setSelectedNode(null);
            }).catch(err => logger.error('Failed to delete entity', err));
          }
          break;
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, focusRingIndex, entities, layout, setSelectedNode]);

  // Use snapshot data when in snapshot mode, otherwise use filtered live data
  const effectiveData = snapshotMode && snapshotData
    ? { entities: snapshotData.nodes.map(n => ({ id: n.id, name: n.label, type: 'snapshot' })), links: snapshotData.edges.map(e => ({ id: e.id, source_id: e.source, target_id: e.target, relation: e.label || '' })) }
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
            onExportPNG={handleExportPNG}
            snapshotMode={snapshotMode}
            onSnapshotModeChange={(active) => { if (!active) handleExitSnapshot(); }}
            layout={layout}
            onLayoutChange={setLayout}
          />
        </div>
      )}
      <div
        ref={containerRef}
        className="viz-container"
        style={{ height: '600px', width: '100%' }}
        role="img"
        aria-label={`Knowledge Graph: ${effectiveData.entities.length} entities, ${effectiveData.links.length} connections${selectedNode ? `. Selected: ${entities.find(e => e.id === selectedNode)?.name || selectedNode}` : ''}`}
        tabIndex={-1}
        aria-roledescription="Interactive knowledge graph showing entities and their relationships"
      />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {(() => {
          if (!selectedNode) return 'Knowledge graph. No entity selected. Use Tab or arrow keys to navigate nodes.';
          const entity = entities.find(e => e.id === selectedNode);
          const name = entity?.name || selectedNode;
          const connections = effectiveData.links.filter(l => l.source_id === selectedNode || l.target_id === selectedNode);
          const neighborNames = connections
            .map(l => {
              const neighborId = l.source_id === selectedNode ? l.target_id : l.source_id;
              const neighbor = entities.find(e => e.id === neighborId);
              return neighbor?.name || neighborId;
            })
            .filter(Boolean);
          return `Selected: ${name}. ${connections.length} connections${neighborNames.length > 0 ? ': ' + neighborNames.slice(0, 5).join(', ') + (neighborNames.length > 5 ? ` and ${neighborNames.length - 5} more` : '') : ''}. Press Tab to next, Enter to inspect, Escape to deselect.`;
        })()}
      </div>
      {selectedNode && (() => {
        const entity = entities.find(e => e.id === selectedNode);
        if (!entity) return null;
        return (
          <GraphInspector
            entity={entity}
            claims={selectedEntityClaims}
            links={selectedEntityLinks}
            entities={entities}
            onClose={() => setSelectedNode(null)}
            onEdit={onEditEntity}
          />
        );
      })()}
    </div>
  );
};

export default GraphView;

