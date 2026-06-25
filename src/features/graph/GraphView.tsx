import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import type { NodeDisplayData, EdgeDisplayData } from 'sigma/types';
import { Entity, Link, Claim } from '../../lib/validation';
import GraphControls from './GraphControls';
import GraphInspector from './GraphInspector';
import { jobCoordinator } from '../../lib/jobs';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { applyCircularLayout, applyForceLayout, applyHierarchicalLayout } from '../../lib/graph-layout';
import { setupGraphSyncListeners } from './sync-adapter';
import { useGraphKeyboardNavigation } from './GraphKeyboardNav';
import { useGraphTouchGestures } from './GraphTouchHandler';
import { useGraphSnapshotManager } from './GraphSnapshotManager';
import { useGraphSyncEvents } from './GraphSyncEvents';
import { getGraphThemeTokens, onThemeChange } from '../../lib/theme-tokens';
import { useGraphUndoRedo } from './useGraphUndoRedo';

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
  const repository = useRepository();
  const { canUndo, canRedo, pushDelete, undo, redo } = useGraphUndoRedo(repository);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph>(new Graph());
  const layoutTimeoutRef = useRef<number | null>(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);
  const [selectedEntityClaims, setSelectedEntityClaims] = useState<Claim[]>([]);
  const [selectedEntityLinks, setSelectedEntityLinks] = useState<Link[]>([]);
  const [layout, setLayout] = useState<LayoutType>('force');
  const [focusRingIndex, setFocusRingIndex] = useState<number>(-1);

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

  const {
    snapshotMode,
    snapshotData,
    handleSaveSnapshot,
    handleLoadSnapshot,
    handleExitSnapshot,
  } = useGraphSnapshotManager(repository);

  useGraphKeyboardNavigation(
    // eslint-disable-next-line react-hooks/refs -- hook uses refs only inside effects, not for rendering
    containerRef.current,
    // eslint-disable-next-line react-hooks/refs -- hook uses refs only inside effects, not for rendering
    sigmaInstance.current,
    // eslint-disable-next-line react-hooks/refs -- hook uses refs only inside effects, not for rendering
    graphRef.current,
    entities,
    selectedNode,
    setSelectedNode,
    focusRingIndex,
    setFocusRingIndex,
    repository,
    (id: string) => { void pushDelete(id); }
  );

  useGraphTouchGestures(
    // eslint-disable-next-line react-hooks/refs -- hook uses refs only inside effects, not for rendering
    containerRef.current,
    // eslint-disable-next-line react-hooks/refs -- hook uses refs only inside effects, not for rendering
    sigmaInstance.current
  );

  const recomputeNeighborhoodHandler = useCallback((payload: unknown) => {
    const { entities, links, selectedNode } = payload as { entities: Entity[], links: Link[], selectedNode: string };
    const neighborIds = new Set<string>([selectedNode]);
    links.forEach((l: Link) => {
      if (l.source_id === selectedNode) neighborIds.add(l.target_id);
      if (l.target_id === selectedNode) neighborIds.add(l.source_id);
    });

    setFilteredData({
      entities: entities.filter((e: Entity) => e.id != null && neighborIds.has(e.id)),
      links: links.filter((l: Link) => neighborIds.has(l.source_id) && neighborIds.has(l.target_id))
    });
    return Promise.resolve();
  }, []);

  const cameraRatioRef = useRef(1);
  const graphSize = useMemo(() => {
    const count = entities.length;
    if (count <= 30) return 'small' as const;
    if (count <= 100) return 'medium' as const;
    if (count <= 500) return 'large' as const;
    return 'xlarge' as const;
  }, [entities.length]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guard reset before async job, not a cascade risk
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
    jobCoordinator.registerHandler('recompute-neighborhood', recomputeNeighborhoodHandler);
    return () => {
      jobCoordinator.unregisterHandler('recompute-neighborhood');
    };
  }, [recomputeNeighborhoodHandler]);

  const effectiveData = useMemo(() => {
    return snapshotMode && snapshotData
      ? { entities: snapshotData.nodes.map(n => ({ id: n.id, name: n.label, type: 'snapshot' })), links: snapshotData.edges.map(e => ({ id: e.id, source_id: e.source, target_id: e.target, relation: e.label || '' })) }
      : filteredData;
  }, [snapshotMode, snapshotData, filteredData]);

  useEffect(() => {
    if (!containerRef.current) return;
    perf.mark('graph-view-mount');

    const graph = graphRef.current;
    const data = effectiveData;

    if (layoutTimeoutRef.current) cancelAnimationFrame(layoutTimeoutRef.current);

    layoutTimeoutRef.current = requestAnimationFrame(() => {
      const currentNodes = new Set(graph.nodes());
      const targetNodes = new Set(data.entities.map(e => e.id ?? ''));

      currentNodes.forEach(nodeId => {
        if (!targetNodes.has(nodeId)) graph.dropNode(nodeId);
      });

      if (data.entities.length === 0 && !focusMode && !snapshotMode) {
        if (!graph.hasNode('placeholder')) {
          const tokens = getGraphThemeTokens();
           graph.addNode('placeholder', { label: 'Knowledge Studio', size: 10, color: tokens.interactivePrimary, x: 0, y: 0 });
        }
      } else {
        if (graph.hasNode('placeholder')) graph.dropNode('placeholder');

        const tokens = getGraphThemeTokens();
        data.entities.forEach((e, i) => {
          const entityId = e.id ?? '';
          const nodeColor = snapshotMode ? tokens.nodeDefault : (e.id === selectedNode ? tokens.nodeSelected : tokens.interactivePrimary);
          if (!graph.hasNode(entityId)) {
            graph.addNode(entityId, {
              label: e.name,
              size: e.id === selectedNode ? 20 : 10,
              color: nodeColor,
              x: Math.cos((i * 2 * Math.PI) / data.entities.length),
              y: Math.sin((i * 2 * Math.PI) / data.entities.length)
            });
          } else {
            graph.mergeNodeAttributes(entityId, {
              label: e.name,
              size: e.id === selectedNode ? 20 : 10,
              color: nodeColor,
            });
          }
        });

        const targetEdgeSet = new Set<string>();
        data.links.forEach((l) => {
          targetEdgeSet.add(`${l.source_id}|${l.target_id}`);
        });

        graph.edges().forEach((edge) => {
          const sourceNode = graph.source(edge);
          const targetNode = graph.target(edge);
          if (!targetEdgeSet.has(`${sourceNode}|${targetNode}`)) {
            graph.dropEdge(edge);
          }
        });

        data.links.forEach((l) => {
          if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
            const tokens = getGraphThemeTokens();
            graph.mergeEdge(l.source_id, l.target_id, {
              label: l.relation,
              size: 2,
              color: snapshotMode ? tokens.edgeHighlighted : tokens.edgeDefault
            });
          }
        });

        if (layout === 'hierarchical') {
          applyHierarchicalLayout(graph, data.entities, links);
        } else if (layout === 'force') {
          applyForceLayout(graph);
        }
      }

      if (!sigmaInstance.current) {
        sigmaInstance.current = new Sigma(graph, containerRef.current!, {
          ...layoutSettings,
          nodeReducer: (node, data) => {
            const ratio = cameraRatioRef.current;
            const nodeData = data as Partial<NodeDisplayData>;
            const result = { ...nodeData };
            if (ratio > 1.5) {
              result.label = nodeData.label;
              result.size = (nodeData.size || 10) * Math.min(ratio, 3);
            } else if (ratio < 0.5) {
              result.label = '';
              result.size = Math.max((nodeData.size || 10) * 0.5, 2);
            } else if (ratio < 0.8 && (graphSize === 'large' || graphSize === 'xlarge')) {
              result.label = '';
              result.size = (nodeData.size || 10) * 0.7;
            } else if (ratio < 1.0 && graphSize === 'xlarge') {
              result.label = '';
              result.size = (nodeData.size || 10) * 0.85;
            }
            const g = graphRef.current;
            if (g && g.getNodeAttribute(node, 'fixed')) {
              result.color = getGraphThemeTokens().interactivePrimary;
            }
            return result;
          },
          edgeReducer: (edge, data) => {
            const ratio = cameraRatioRef.current;
            const result = { ...data } as Partial<EdgeDisplayData>;
            if (ratio < 0.5) {
              result.label = '';
              result.hidden = true;
            } else if (ratio < 0.8 && graphSize === 'large') {
              result.label = '';
              result.size = Math.min((data.size as number) || 1, 0.5);
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
          const currentFixed = graph.getNodeAttribute(node, 'fixed') as boolean | undefined ?? false;
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
  }, [effectiveData, selectedNode, focusMode, snapshotMode, setFocusMode, setSelectedNode, layout, layoutSettings, links, graphSize]);

  useEffect(() => {
    if (!graphRef.current) return;
    const cleanup = setupGraphSyncListeners(graphRef.current);
    return cleanup;
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state before async operation
      setSelectedEntityClaims([]);
      setSelectedEntityLinks([]);
      return;
    }
    repository.getClaimsByEntityId(selectedNode).then(claims => {
      setSelectedEntityClaims(claims);
    }).catch(err => logger.error('Failed to fetch entity claims', err));
    setSelectedEntityLinks(links.filter(l => l.source_id === selectedNode || l.target_id === selectedNode));
  }, [selectedNode, links, repository]);

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
        applyHierarchicalLayout(graph, effectiveData.entities, links);
        break;
    }
    sigma.refresh();
    void sigma.getCamera().animatedReset({ duration: 400 });
  }, [layout, effectiveData.entities, links]);

  useEffect(() => {
    return () => {
      sigmaInstance.current?.kill();
      sigmaInstance.current = null;
    };
  }, []);

  // Re-render graph when theme changes
  useEffect(() => {
    const disconnect = onThemeChange(() => {
      const sigma = sigmaInstance.current;
      const graph = graphRef.current;
      if (!sigma || !graph) return;

      const tokens = getGraphThemeTokens();
      graph.forEachNode((node) => {
        const attrs = graph.getNodeAttributes(node);
        const isFixed = attrs.fixed as boolean | undefined;
        const isSelected = node === selectedNode;
        const isSnapshot = snapshotMode;
        const newNodeColor = isFixed
          ? tokens.interactivePrimary
          : isSnapshot
            ? tokens.nodeDefault
            : isSelected
              ? tokens.nodeSelected
              : tokens.interactivePrimary;
        graph.setNodeAttribute(node, 'color', newNodeColor);
      });

      graph.forEachEdge((edge) => {
        const isSnapshot = snapshotMode;
        const newEdgeColor = isSnapshot ? tokens.edgeHighlighted : tokens.edgeDefault;
        graph.setEdgeAttribute(edge, 'color', newEdgeColor);
      });

      sigma.refresh();
    });
    return disconnect;
  }, [selectedNode, snapshotMode]);

  useGraphSyncEvents(graphRef);

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
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={() => void undo()}
            onRedo={() => void redo()}
          />
        </div>
      )}
      <div
        ref={containerRef}
        className="viz-container"
        style={{ height: 'clamp(400px, 60vh, 800px)', width: '100%' }}
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
