import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, ExternalLink, Info, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import { Entity, Claim, Link } from '../../lib/validation';
import { repository } from '../../db/repository';
import { removeFromSearchIndex } from '../../lib/search';
import { logger } from '../../lib/logger';

interface GraphInspectorProps {
  entity: Entity;
  claims: Claim[];
  links: Link[];
  entities: Entity[];
  onClose: () => void;
  onEdit?: (entityId: string) => void;
}

const GraphInspector: React.FC<GraphInspectorProps> = ({
  entity,
  claims,
  links,
  entities,
  onClose,
  onEdit,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const outgoingLinks = useMemo(() =>
    links.filter(l => l.source_id === entity.id),
    [links, entity.id]
  );

  const incomingLinks = useMemo(() =>
    links.filter(l => l.target_id === entity.id),
    [links, entity.id]
  );

  const claimsScrollRef = useRef<HTMLDivElement>(null);
  const relationsScrollRef = useRef<HTMLDivElement>(null);

  const allRelations = useMemo(() => {
    const items: Array<{ type: 'outgoing' | 'incoming'; id: string; relation: string; targetId: string }> = [];
    for (const link of outgoingLinks) {
      items.push({ type: 'outgoing', id: link.id!, relation: link.relation, targetId: link.target_id });
    }
    for (const link of incomingLinks) {
      items.push({ type: 'incoming', id: link.id!, relation: link.relation, targetId: link.source_id });
    }
    return items;
  }, [outgoingLinks, incomingLinks]);

  const claimVirtualizer = useVirtualizer({
    count: claims.length,
    getScrollElement: () => claimsScrollRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  const relationVirtualizer = useVirtualizer({
    count: allRelations.length,
    getScrollElement: () => relationsScrollRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const getEntityName = (id: string) =>
    entities.find(e => e.id === id)?.name || 'Unknown Entity';

  return (
    <aside className="inspector-panel" aria-label={`Details for ${entity.name}`}>
      <div className="inspector-header">
        <h3>{entity.name}</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onEdit?.(entity.id!)}
            aria-label={`Edit ${entity.name}`}
            title="Edit entity"
            style={{ padding: '6px', minHeight: '36px', minWidth: '36px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${entity.name}"? This will also delete all claims and links for this entity.`)) {
                setIsDeleting(true);
                void repository.deleteEntity(entity.id!).then(() => {
                  void removeFromSearchIndex(entity.id!);
                  logger.info('Entity deleted', { id: entity.id });
                  onClose();
                }).catch(err => {
                  logger.error('Failed to delete entity', err);
                  setIsDeleting(false);
                });
              }
            }}
            disabled={isDeleting}
            aria-label={`Delete ${entity.name}`}
            title="Delete entity"
            style={{ padding: '6px', minHeight: '36px', minWidth: '36px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-danger, #ef4444)' }}
          >
            <Trash2 size={16} />
          </button>
          <button className="close-button" onClick={onClose} aria-label="Close inspector">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="inspector-content" style={{ overflow: 'auto', flex: 1 }}>
        <div className="inspector-section">
          <div className="result-type">{entity.type}</div>
          {entity.description && (
            <p className="result-description">{entity.description}</p>
          )}
        </div>

        {claims.length > 0 && (
          <div className="inspector-section">
            <h4><ShieldCheck size={14} /> Claims <span className="text-muted">({claims.length})</span></h4>
            <div ref={claimsScrollRef} style={{ overflow: 'auto', maxHeight: '300px' }}>
              <ul className="results-list" style={{ height: `${claimVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {claimVirtualizer.getVirtualItems().map(virtualItem => {
                  const claim = claims[virtualItem.index];
                  return (
                    <li key={claim.id} className="search-result-item" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}>
                      <div className="msg-text" style={{ fontSize: '13px' }}>{claim.statement}</div>
                      {claim.evidence && (
                        <div className="result-meta" style={{ marginTop: '4px' }}>
                          <span className="provenance-tag">Evidence: {claim.evidence}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {allRelations.length > 0 && (
          <div className="inspector-section">
            <h4><ExternalLink size={14} /> Relationships <span className="text-muted">({allRelations.length})</span></h4>
            <div ref={relationsScrollRef} style={{ overflow: 'auto', maxHeight: '300px' }}>
              <ul className="results-list" style={{ height: `${relationVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {relationVirtualizer.getVirtualItems().map(virtualItem => {
                  const rel = allRelations[virtualItem.index];
                  return (
                    <li key={rel.id} className="search-result-item" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}>
                      <div style={{ fontSize: '13px' }}>
                        {rel.type === 'outgoing' ? (
                          <><strong>{rel.relation}</strong> → {getEntityName(rel.targetId)}</>
                        ) : (
                          <>{getEntityName(rel.targetId)} → <strong>{rel.relation}</strong></>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {claims.length === 0 && outgoingLinks.length === 0 && incomingLinks.length === 0 && (
          <div className="no-results-state" style={{ padding: 'var(--space-4)' }}>
            <Info size={24} className="no-results-icon" />
            <p>No claims or links found for this entity.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default GraphInspector;
