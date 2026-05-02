import React, { useEffect, useRef, useState, useMemo } from 'react';
import MindElixir, { type MindElixirData } from 'mind-elixir';
import { Entity, Link } from '../../lib/validation';
import { ChevronDown, Layers, Filter, Info } from 'lucide-react';

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
  entities: Entity[];
  links: Link[];
  onEntityClick?: (entityId: string) => void;
}

const MindMapView: React.FC<Props> = ({
  rootEntity: propsRootEntity,
  relatedEntities: _relatedEntities,
  entities,
  links,
  onEntityClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mindInstance = useRef<any>(null);
  const [rootId, setRootId] = useState<string>(propsRootEntity.id || '');
  const [maxDepth, setMaxDepth] = useState(2);
  const [relationFilter, setRelationFilter] = useState('all');

  const rootEntity = useMemo(() =>
    entities.find(e => e.id === rootId) || propsRootEntity,
    [entities, rootId, propsRootEntity]
  );

  const uniqueRelations = useMemo(() => {
    const relations = new Set(links.map(l => l.relation));
    return ['all', ...Array.from(relations)];
  }, [links]);

  const treeData = useMemo(() => {
    const buildTree = (currentId: string, depth: number): MindElixirData['nodeData'] | null => {
      const entity = entities.find(e => e.id === currentId);
      if (!entity || depth > maxDepth) return null;

      const childrenLinks = links.filter(l =>
        l.source_id === currentId &&
        (relationFilter === 'all' || l.relation === relationFilter)
      );

      return {
        id: entity.id || `node-${Math.random()}`,
        topic: entity.name,
        children: childrenLinks
          .map(l => buildTree(l.target_id, depth + 1))
          .filter((n): n is MindElixirData['nodeData'] => n !== null)
      };
    };

    return buildTree(rootId, 0) || { id: 'root', topic: 'No data' };
  }, [rootId, entities, links, maxDepth, relationFilter]);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const options = {
      el: containerRef.current,
      direction: 2, // SIDE
      draggable: true,
      contextMenu: true,
      toolBar: true,
      nodeMenu: true,
      keypress: true,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mindInstance.current = new (MindElixir as any)(options);
    mindInstance.current.init({
      nodeData: treeData
    } as MindElixirData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mindInstance.current.bus.addListener('selectNode', (node: any) => {
      if (node.id && onEntityClick) {
        onEntityClick(node.id);
      }
    });

    return () => {
      if (mindInstance.current) {
        // MindElixir doesn't have a clear kill method in some versions,
        // but we can clear the container
        if (currentContainer) currentContainer.innerHTML = '';
      }
    };
  }, [treeData, onEntityClick]);

  return (
    <div className="graph-container">
      <div className="viz-toolbar">
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ChevronDown size={16} className="text-muted" />
          <select
            value={rootId}
            onChange={(e) => setRootId(e.target.value)}
            className="filter-chip"
            style={{ width: 'auto' }}
            aria-label="Select root entity"
          >
            {entities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Layers size={16} className="text-muted" />
          <select
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="filter-chip"
            style={{ width: 'auto' }}
            aria-label="Set depth"
          >
            {[1, 2, 3, 4, 5].map(d => (
              <option key={d} value={d}>Depth: {d}</option>
            ))}
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={16} className="text-muted" />
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="filter-chip"
            style={{ width: 'auto' }}
            aria-label="Filter relations"
          >
            {uniqueRelations.map(rel => (
              <option key={rel} value={rel}>{rel === 'all' ? 'All Relations' : rel}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="viz-container" style={{ flex: 1, minHeight: '600px' }}>
        <div ref={containerRef} className="viz-canvas" />

        {/* Accessible Summary */}
        <div className="sr-only">
          <h4>Mind Map Summary</h4>
          <p>Rooted at {rootEntity.name}. Depth: {maxDepth}.</p>
          <p>This visualization shows a hierarchical view of entities based on their relationships.</p>
        </div>
      </div>

      <div className="selection-info" style={{ padding: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Info size={14} />
        <span>Click a node to view details or drag to explore.</span>
      </div>
    </div>
  );
};

export default MindMapView;
