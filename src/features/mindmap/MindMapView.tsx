import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import MindElixir, { type MindElixirData, type MindElixirInstance } from 'mind-elixir';
import { Entity, Link } from '../../lib/validation';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';
import { upsertToSearchIndex } from '../../lib/search';
import { perf } from '../../lib/perf';
import { ChevronDown, Layers, Filter, Info, ChevronRight } from 'lucide-react';

const COLLAPSED_BY_DEFAULT_THRESHOLD = 20;
const EXPENSIVE_RECALC_THRESHOLD = 50;

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
  entities: Entity[];
  links: Link[];
  onEntityClick?: (entityId: string) => void;
}

interface Bus {
  addListener: (event: string, handler: (node: { id: string }) => void) => void;
}

function buildTree(
  currentId: string,
  depth: number,
  maxDepth: number,
  entities: Entity[],
  links: Link[],
  relationFilter: string,
): MindElixirData['nodeData'] | null {
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
      .map(l => buildTree(l.target_id, depth + 1, maxDepth, entities, links, relationFilter))
      .filter((n): n is MindElixirData['nodeData'] => n !== null)
  };
}

const MindMapView: React.FC<Props> = ({
  rootEntity: propsRootEntity,
  relatedEntities: _relatedEntities,
  entities,
  links,
  onEntityClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindInstance = useRef<{ init: (data: { nodeData: MindElixirData['nodeData'] }) => void; bus: Bus } | null>(null);
  const treeDataRef = useRef<string>('');
  const [rootId, setRootId] = useState<string>(propsRootEntity.id || '');
  const [maxDepth, setMaxDepth] = useState(2);
  const [relationFilter, setRelationFilter] = useState('all');
  const [collapsedByDefault, setCollapsedByDefault] = useState(entities.length > COLLAPSED_BY_DEFAULT_THRESHOLD);

  const rootEntity = useMemo(() =>
    entities.find(e => e.id === rootId) || propsRootEntity,
    [entities, rootId, propsRootEntity]
  );

  const uniqueRelations = useMemo(() => {
    const relations = new Set(links.map(l => l.relation));
    return ['all', ...Array.from(relations)];
  }, [links]);

  const isLargeMap = entities.length > EXPENSIVE_RECALC_THRESHOLD;

  const treeData = useMemo(() => {
    const effectiveDepth = collapsedByDefault ? Math.min(maxDepth, 1) : maxDepth;
    return buildTree(rootId, 0, effectiveDepth, entities, links, relationFilter) || { id: 'root', topic: 'No data' };
  }, [rootId, entities, links, maxDepth, relationFilter, collapsedByDefault]);

  // Only recreate MindElixir instance when treeData actually changes
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const serialized = JSON.stringify(treeData);
    if (treeDataRef.current === serialized) return;
    treeDataRef.current = serialized;

    perf.mark('mindmap-mount');

    const options = {
      el: containerRef.current,
      direction: 2,
      draggable: true,
      contextMenu: !isLargeMap,
      toolBar: !isLargeMap,
      nodeMenu: true,
      keypress: true,
    };

    const instance: MindElixirInstance = new (MindElixir as new (options: Record<string, unknown>) => MindElixirInstance)(options);
    mindInstance.current = instance;
    instance.init({
      nodeData: treeData
    });
    perf.measure('mindmap-init', 'mindmap-mount');

    mindInstance.current.bus.addListener('selectNode', (node) => {
      if (node.id && onEntityClick) {
        onEntityClick(node.id);
      }
    });

    // Wire MindElixir operations to repository
    const bus = mindInstance.current.bus;
    bus.addListener('operation', (op: Record<string, unknown>) => {
      const opName = op.name as string;
      if (opName === 'addChild') {
        const obj = op.obj as Record<string, unknown> | undefined;
        if (obj?.topic) {
          void (async () => {
            try {
              const newEntity = await repository.createEntity({
                name: obj.topic as string,
                type: 'note',
                description: '',
                metadata: {},
              });
              logger.info('Created entity from mind map child', { id: newEntity.id, name: obj.topic });
              if (rootId && newEntity.id) {
                await repository.createLink({
                  source_id: rootId,
                  target_id: newEntity.id,
                  relation: 'hierarchy',
                });
              }
            } catch (err) {
              logger.error('Failed to create entity from mind map', err);
            }
          })();
        }
      } else if (opName === 'finishEdit') {
        const obj = op.obj as Record<string, unknown> | undefined;
        if (obj?.id && obj?.topic) {
          const nodeId = obj.id as string;
          const newTopic = obj.topic as string;
          if (/^[0-9a-f-]{36}$/i.test(nodeId)) {
            void (async () => {
              try {
                await repository.updateEntity(nodeId, { name: newTopic });
                await upsertToSearchIndex(nodeId);
                logger.info('Updated entity name from mind map', { id: nodeId, name: newTopic });
              } catch (err) {
                logger.error('Failed to update entity name from mind map', err);
              }
            })();
          }
        }
      } else if (opName === 'removeNodes') {
        const objs = op.objs as Record<string, unknown>[] | undefined;
        if (Array.isArray(objs)) {
          void (async () => {
            try {
              for (const nodeObj of objs) {
                const nodeId = nodeObj.id as string | undefined;
                if (nodeId && /^[0-9a-f-]{36}$/i.test(nodeId)) {
                  await repository.deleteEntity(nodeId);
                  logger.info('Deleted entity from mind map', { id: nodeId });
                }
              }
            } catch (err) {
              logger.error('Failed to delete entities from mind map', err);
            }
          })();
        }
      }
    });

    return () => {
      if (mindInstance.current) {
        if (currentContainer) currentContainer.innerHTML = '';
      }
    };
  }, [treeData, onEntityClick, isLargeMap, rootId]);

  const handleResetRoot = useCallback(() => {
    setRootId(propsRootEntity.id || '');
  }, [propsRootEntity.id]);

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

        <button
          onClick={() => setCollapsedByDefault(!collapsedByDefault)}
          className={`filter-chip ${collapsedByDefault ? 'active' : ''}`}
          aria-pressed={collapsedByDefault}
          title={collapsedByDefault ? 'Expand all branches' : 'Collapse deep branches'}
        >
          <ChevronRight size={14} />
          {collapsedByDefault ? 'Expand' : 'Compact'}
        </button>
        <div className="layout-toggle" style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            Tab: Add Child | F2: Rename | Del: Delete
          </span>
        </div>
      </div>

      <div className="viz-container" style={{ flex: 1, minHeight: '600px' }}>
        <div ref={containerRef} className="viz-canvas" />

        <div className="sr-only">
          <h4>Mind Map Summary</h4>
          <p>Rooted at {rootEntity.name}. Depth: {maxDepth}.</p>
          <p>This visualization shows a hierarchical view of entities based on their relationships.</p>
        </div>
      </div>

      <div className="selection-info" style={{ padding: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Info size={14} />
        <span>Click a node to view details or drag to explore.</span>
        {rootEntity.id !== propsRootEntity.id && (
          <button onClick={handleResetRoot} className="filter-chip" style={{ marginLeft: 'auto' }}>
            Reset Root
          </button>
        )}
      </div>
    </div>
  );
};

export default MindMapView;
