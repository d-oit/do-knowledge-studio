import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import MindElixir, { type MindElixirData, type MindElixirInstance } from 'mind-elixir';
import { useGraphSyncStore } from '../../store/graph-sync-store';
import { setupMindMapSyncListeners } from './sync-adapter';
import type { SharedNode } from '../../store/graph-sync-types';
import type { Entity, Link } from '../../lib/validation';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';
import { upsertToSearchIndex } from '../../lib/search';
import { perf } from '../../lib/perf';
import SyncToggle from '../../components/SyncToggle';
import { ChevronDown, Layers, Filter, Info, ChevronRight, Plus, GitBranch, Pencil, Trash2, Image } from 'lucide-react';

const COLLAPSED_BY_DEFAULT_THRESHOLD = 20;
const EXPENSIVE_RECALC_THRESHOLD = 50;

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
  entities: Entity[];
  links: Link[];
  onEntityClick?: (entityId: string) => void;
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

function addAriaToNodes(container: HTMLElement): void {
  const topics = container.querySelectorAll('me-tpc');
  topics.forEach(tpc => {
    const parent = tpc.closest('me-parent');
    if (parent && !parent.hasAttribute('role')) {
      parent.setAttribute('role', 'treeitem');
      parent.setAttribute('aria-label', tpc.textContent?.trim() || 'Mind map node');
    }
  });
}

function addAriaAttributesToContainer(container: HTMLElement): void {
  container.setAttribute('role', 'tree');
  addAriaToNodes(container);
  const nodeObserver = new MutationObserver(() => { addAriaToNodes(container); });
  nodeObserver.observe(container, { childList: true, subtree: true });
  setTimeout(() => { nodeObserver.disconnect(); }, 2000);
}

const MindMapView: React.FC<Props> = ({
  rootEntity: propsRootEntity,
  relatedEntities: _relatedEntities,
  entities,
  links,
  onEntityClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindInstance = useRef<MindElixirInstance | null>(null);
  const treeDataRef = useRef<string>('');
  const [rootId, setRootId] = useState<string>(propsRootEntity.id || '');
  const [maxDepth, setMaxDepth] = useState(2);
  const [relationFilter, setRelationFilter] = useState('all');
  const [collapsedByDefault, setCollapsedByDefault] = useState(entities.length > COLLAPSED_BY_DEFAULT_THRESHOLD);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMindReady, setIsMindReady] = useState(false);

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
      editable: true,
      contextMenu: !isLargeMap,
      toolBar: !isLargeMap,
      nodeMenu: true,
      keypress: true,
    };

    const MindElixirCtor = MindElixir as new (options: Record<string, unknown>) => MindElixirInstance;
    const instance: MindElixirInstance = new MindElixirCtor(options);
    mindInstance.current = instance;
    setIsMindReady(true);
    instance.init({
      nodeData: treeData
    });
    setupMindMapSyncListeners(instance);
    perf.measure('mindmap-init', 'mindmap-mount');

    mindInstance.current.bus.addListener('selectNode', (node: { id?: string }) => {
      const nodeId = node.id || null;
      setSelectedNodeId(nodeId);
      const label = nodeId ? (entities.find(e => e.id === nodeId)?.name || null) : null;
      setSelectedNodeName(label);
      if (nodeId && onEntityClick) {
        onEntityClick(nodeId);
      }
    });

    // Add ARIA attributes to Mind Elixir nodes
    addAriaAttributesToContainer(currentContainer);

    // Wire MindElixir operations to repository
    const bus = mindInstance.current.bus;
    bus.addListener('operation', (op: Record<string, unknown>) => {
      const opName = op.name as string;
      if (opName === 'addChild') {
        const obj = op.obj as Record<string, unknown> | undefined;
        if (obj?.topic) {
          void (async () => {
            try {
              const parentObj = obj.parent as Record<string, unknown> | undefined;
              const parentId = parentObj?.id as string | undefined;
              const newEntity = await repository.createEntity({
                name: obj.topic as string,
                type: 'note',
                description: '',
                metadata: {},
              });
              logger.info('Created entity from mind map child', { id: newEntity.id, name: obj.topic });
              const topicEl = mindInstance.current?.findEle(obj.id as string);
              if (topicEl && newEntity.id) {
                topicEl.nodeObj.id = newEntity.id;
              }
              const validParent = parentId && /^[0-9a-f-]{36}$/i.test(parentId);
              if (validParent && newEntity.id) {
                await repository.createLink({
                  source_id: parentId,
                  target_id: newEntity.id,
                  relation: 'hierarchy',
                });
              } else if (!validParent && rootId && newEntity.id) {
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
        if (currentContainer) currentContainer.replaceChildren();
        mindInstance.current = null;
        setIsMindReady(false);
      }
    };
  }, [treeData, onEntityClick, isLargeMap, rootId, entities]);

  // Sync effect to consume events
  useEffect(() => {
    const unsubscribe = useGraphSyncStore.subscribe((state) => {
      if (!state.syncEnabled || !mindInstance.current || state.pendingEvents.length === 0) return;

      const events = useGraphSyncStore.getState().consumeEvents('mindmap');
      if (events.length === 0) return;

      events.forEach(event => {
        const payload = event.payload as SharedNode;
        if (event.type === 'node:add') {
          if (!mindInstance.current?.findEle(payload.id)) {
            // Add as child of root for simplicity if not specified
            void mindInstance.current?.addChild(mindInstance.current.findEle(rootId), {
              id: payload.id,
              topic: payload.label
            });
          }
        } else if (event.type === 'node:update') {
          const el = mindInstance.current?.findEle(payload.id);
          if (el && el.nodeObj.topic !== payload.label) {
            console.warn(`[Sync Conflict] Mind map node ${payload.id} has different label. Local: ${el.nodeObj.topic}, Incoming: ${payload.label}. Applying last-writer wins.`);
            mindInstance.current?.updateNodeStyle(payload.id); // eslint-disable-line @typescript-eslint/no-unsafe-call -- MindElixir types incomplete
            el.nodeObj.topic = payload.label;
            mindInstance.current?.refresh();
          }
        } else if (event.type === 'node:remove') {
          const el = mindInstance.current?.findEle(payload.id);
          if (el) {
            void mindInstance.current?.removeNodes([el]);
          }
        }
      });
    });
    return () => unsubscribe();
  }, [rootId]);

  const handleResetRoot = useCallback(() => {
    setRootId(propsRootEntity.id || '');
  }, [propsRootEntity.id]);

  const handleAddChild = useCallback(() => {
    if (mindInstance.current) {
      void mindInstance.current.addChild();
    }
  }, []);

  const handleAddSibling = useCallback(() => {
    if (mindInstance.current && selectedNodeId) {
      void mindInstance.current.insertSibling('after');
    }
  }, [selectedNodeId]);

  const handleRename = useCallback(() => {
    if (mindInstance.current) {
      void mindInstance.current.beginEdit();
    }
  }, []);

  const handleDelete = useCallback(() => {
    if (mindInstance.current && selectedNodeId) {
      const topic = mindInstance.current.findEle(selectedNodeId);
      if (topic) {
        void mindInstance.current.removeNodes([topic]);
      }
    }
  }, [selectedNodeId]);

  const handleExportPng = useCallback(async () => {
    if (mindInstance.current) {
      try {
        const blob = await mindInstance.current.exportPng();
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.download = `mindmap-${Date.now()}.png`;
          a.href = url;
          a.click();
          URL.revokeObjectURL(url);
          logger.info('Mind map exported as PNG');
        }
      } catch (err) {
        logger.error('Failed to export mind map as PNG', err);
      }
    }
  }, []);

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

        <span style={{ width: '1px', height: '20px', background: 'var(--border-default)', margin: '0 4px' }} />

        <button
          onClick={handleAddChild}
          className="filter-chip"
          disabled={!isMindReady}
          title="Add child node"
          aria-label="Add child node"
        >
          <Plus size={14} /> Add Child
        </button>
        <button
          onClick={handleAddSibling}
          className="filter-chip"
          disabled={!selectedNodeId}
          title="Add sibling node"
          aria-label="Add sibling node"
        >
          <GitBranch size={14} /> Add Sibling
        </button>
        <button
          onClick={handleRename}
          className="filter-chip"
          disabled={!selectedNodeId}
          title="Rename selected node"
          aria-label="Rename selected node"
        >
          <Pencil size={14} /> Rename
        </button>
        <button
          onClick={handleDelete}
          className="filter-chip"
          disabled={!selectedNodeId}
          title="Delete selected node"
          aria-label="Delete selected node"
        >
          <Trash2 size={14} /> Delete
        </button>

        <span style={{ width: '1px', height: '20px', background: 'var(--border-default)', margin: '0 4px' }} />

        <SyncToggle />

        <button
          onClick={() => { void handleExportPng(); }}
          className="filter-chip"
          disabled={!isMindReady}
          title="Export as PNG"
          aria-label="Export mind map as PNG"
        >
          <Image size={14} /> Export PNG
        </button>

        <div className="layout-toggle" style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            Tab: Add Child | F2: Rename | Del: Delete
          </span>
        </div>
      </div>

      <div className="viz-container" style={{ flex: 1, minHeight: '600px' }}>
        <div ref={containerRef} className="viz-canvas" />

        <div className="sr-only" aria-live="polite">
          <h4>Mind Map Summary</h4>
          <p>Rooted at {rootEntity.name}. Depth: {maxDepth}.{selectedNodeName ? ` Selected: ${selectedNodeName}.` : ''}</p>
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
