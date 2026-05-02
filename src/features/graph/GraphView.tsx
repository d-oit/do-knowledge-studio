import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link, Claim } from '../../lib/validation';
import GraphControls from './GraphControls';
import GraphInspector from './GraphInspector';
import { jobCoordinator } from '../../lib/jobs';
import { repository } from '../../db/repository';
import { Filter } from 'lucide-react';

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
  hideToolbar: _hideToolbar
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<Sigma | null>(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>(null);
  const [internalFocusMode, setInternalFocusMode] = useState(false);
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [selectedEntityClaims, setSelectedEntityClaims] = useState<Claim[]>([]);

  const selectedNode = propsSelectedNode !== undefined ? propsSelectedNode : internalSelectedNode;
  const focusMode = propsFocusMode !== undefined ? propsFocusMode : internalFocusMode;

  // Sync with URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const node = params.get('node');
    const focus = params.get('focus') === 'true';

    if (node && node !== selectedNode) {
      if (onSelectedNodeChange) onSelectedNodeChange(node);
      else setInternalSelectedNode(node);
    }
    if (focus !== focusMode) {
      if (onFocusModeChange) onFocusModeChange(focus);
      else setInternalFocusMode(focus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedNode = useCallback((node: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (node) params.set('node', node);
    else params.delete('node');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

    if (onSelectedNodeChange) onSelectedNodeChange(node);
    else setInternalSelectedNode(node);
  }, [onSelectedNodeChange]);

  const setFocusMode = useCallback((focus: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (focus) params.set('focus', 'true');
    else params.delete('focus');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

    if (onFocusModeChange) onFocusModeChange(focus);
    else setInternalFocusMode(focus);
  }, [onFocusModeChange]);

  const uniqueRelations = useMemo(() => {
    const relations = new Set(links.map(l => l.relation));
    return ['all', ...Array.from(relations)];
  }, [links]);

  useEffect(() => {
    if (selectedNode) {
      repository.getClaimsByEntityId(selectedNode).then(setSelectedEntityClaims);
    } else {
      setSelectedEntityClaims([]);
    }
  }, [selectedNode]);

  const [filteredData, setFilteredData] = useState({ entities, links });

  useEffect(() => {
    let currentEntities = entities;
    let currentLinks = links;

    if (relationFilter !== 'all') {
      currentLinks = links.filter(l => l.relation === relationFilter);
      const activeNodeIds = new Set([
        ...currentLinks.map(l => l.source_id),
        ...currentLinks.map(l => l.target_id)
      ]);
      currentEntities = entities.filter(e => activeNodeIds.has(e.id!));
    }

    if (!focusMode || !selectedNode) {
      setFilteredData({ entities: currentEntities, links: currentLinks });
      return;
    }

    jobCoordinator.enqueue('recompute-neighborhood', selectedNode, {
      entities: currentEntities,
      links: currentLinks,
      selectedNode,
      focusMode
    });
  }, [entities, links, selectedNode, focusMode, relationFilter]);

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

    const graph = new Graph();

    if (filteredData.entities.length === 0 && !focusMode) {
      graph.addNode('1', {
        label: 'Knowledge Studio',
        size: 15,
        color: 'var(--viz-node-default)',
        x: 0,
        y: 0
      });
    } else {
      filteredData.entities.forEach((e, i) => {
        const isSelected = e.id === selectedNode;
        let color = 'var(--viz-node-default)';
        if (isSelected) color = 'var(--viz-node-selected)';
        else if (e.type === 'concept') color = 'var(--viz-node-concept)';
        else if (e.type === 'person') color = 'var(--viz-node-person)';
        else if (e.type === 'project') color = 'var(--viz-node-project)';

        graph.addNode(e.id ?? String(i), {
          label: e.name,
          size: isSelected ? 20 : 10,
          color,
          x: Math.cos((i * 2 * Math.PI) / filteredData.entities.length),
          y: Math.sin((i * 2 * Math.PI) / filteredData.entities.length)
        });
      });
      filteredData.links.forEach((l) => {
        if (graph.hasNode(l.source_id) && graph.hasNode(l.target_id)) {
          graph.addEdge(l.source_id, l.target_id, {
            label: l.relation,
            size: 2,
            color: 'var(--viz-edge-default)'
          });
        }
      });
    }

    if (sigmaInstance.current) {
        sigmaInstance.current.kill();
    }

    sigmaInstance.current = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: true,
      defaultEdgeType: 'arrow',
      labelRenderedSizeThreshold: 10
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

  const selectedEntity = useMemo(() =>
    entities.find(e => e.id === selectedNode),
    [entities, selectedNode]
  );

  return (
    <div className="graph-container">
      <div className="viz-toolbar">
        <GraphControls
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          hasSelection={!!selectedNode}
          selectedName={selectedEntity?.name}
        />

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <Filter size={16} className="text-muted" />
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="filter-chip"
            style={{ minHeight: '32px', width: 'auto' }}
            aria-label="Filter by relationship type"
          >
            {uniqueRelations.map(rel => (
              <option key={rel} value={rel}>
                {rel === 'all' ? 'All Relations' : rel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="graph-layout">
        <div className="viz-container" style={{ flex: 1 }}>
          <div ref={containerRef} className="viz-canvas" />

          {/* Accessible Summary */}
          <div className="sr-only">
            <h4>Graph Summary</h4>
            <p>Showing {filteredData.entities.length} entities and {filteredData.links.length} relationships.</p>
            <ul>
              {filteredData.entities.map(e => (
                <li key={e.id}>{e.name} ({e.type})</li>
              ))}
            </ul>
          </div>
        </div>

        {selectedEntity && (
          <GraphInspector
            entity={selectedEntity}
            claims={selectedEntityClaims}
            links={links}
            entities={entities}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
};

export default GraphView;
