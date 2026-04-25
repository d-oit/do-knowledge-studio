import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity, Link } from '../../lib/validation';
import GraphControls from './GraphControls';
import { jobCoordinator } from '../../lib/jobs';
import { repository } from '../../db/repository';
import { ExternalLink } from 'lucide-react';

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

  const [linkedBlocks, setLinkedBlocks] = useState<Link[]>([]);

  useEffect(() => {
    if (selectedNode) {
      repository.getAllLinks().then(allLinks => {
        const blocks = allLinks.filter(l => l.target_id === selectedNode && (l.metadata as any)?.block_id);
        setLinkedBlocks(blocks);
      });
    } else {
      setLinkedBlocks([]);
    }
  }, [selectedNode]);

  const jumpToBlock = (blockId: string) => {
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-block');
      setTimeout(() => el.classList.remove('highlight-block'), 2000);
    }
  };

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
          {linkedBlocks.length > 0 && (
            <div className="block-links-list">
              {linkedBlocks.map(l => (
                <button key={l.id} className="block-link-jump" onClick={() => jumpToBlock((l.metadata as any).block_id)}>
                  <ExternalLink size={14} /> Jump to Block
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className="viz-container" style={{ flex: 1, width: '100%' }} />
    </div>
  );
};

export default GraphView;
