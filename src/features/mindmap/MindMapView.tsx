import React, { useEffect, useRef, useState } from 'react';
import MindElixir, { type Options } from 'mind-elixir';
import { Entity, Link } from '../../lib/validation';
import { repository } from '../../db/repository';
import { ExternalLink } from 'lucide-react';

interface Props {
  rootEntity: Entity;
  relatedEntities: Entity[];
}

const MindMapView: React.FC<Props> = ({ rootEntity, relatedEntities }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const options: Options = {
      el: containerRef.current,
      direction: 2, // SIDE
    };

    const mind = new MindElixir(options);

    mind.init({
      nodeData: {
        id: rootEntity.id ?? 'root',
        topic: rootEntity.name,
        // root: true, // Type definition might not include this in some versions
        children: relatedEntities.map(e => ({
          id: e.id ?? Math.random().toString(),
          topic: e.name
        }))
      }
    });

  (mind.bus as any).addListener('selectNode', (node: any) => {
    setSelectedNode(node.id);
  });

  (mind.bus as any).addListener('unselectNode', () => {
    setSelectedNode(null);
  });
  }, [rootEntity, relatedEntities]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
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
    <div className="mindmap-container">
      {linkedBlocks.length > 0 && (
        <div className="viz-toolbar overlay">
          <div className="block-links-list">
            {linkedBlocks.map(l => (
              <button key={l.id} className="block-link-jump" onClick={() => jumpToBlock((l.metadata as any).block_id)}>
                <ExternalLink size={14} /> Jump to Block
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={containerRef} className="viz-container" />
    </div>
  );
};

export default MindMapView;
