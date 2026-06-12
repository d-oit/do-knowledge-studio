import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, ExternalLink, Info, ShieldCheck, Pencil, Trash2, Link2 } from 'lucide-react';
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
  "use no memo"; // opt out of React Compiler — useVirtualizer returns non-memoizable functions
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
  const outgoingScrollRef = useRef<HTMLDivElement>(null);
  const incomingScrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is stable; component opts out of React Compiler via "use no memo"
  const claimVirtualizer = useVirtualizer({
    count: claims.length,
    getScrollElement: () => claimsScrollRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is stable; component opts out of React Compiler via "use no memo"
  const outgoingVirtualizer = useVirtualizer({
    count: outgoingLinks.length,
    getScrollElement: () => outgoingScrollRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is stable; component opts out of React Compiler via "use no memo"
  const incomingVirtualizer = useVirtualizer({
    count: incomingLinks.length,
    getScrollElement: () => incomingScrollRef.current,
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

        {outgoingLinks.length > 0 && (
          <div className="inspector-section">
            <h4><ExternalLink size={14} /> Relationships <span className="text-muted">({outgoingLinks.length})</span></h4>
            <div ref={outgoingScrollRef} style={{ overflow: 'auto', maxHeight: '300px' }}>
              <ul className="results-list" style={{ height: `${outgoingVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {outgoingVirtualizer.getVirtualItems().map(virtualItem => {
                  const link = outgoingLinks[virtualItem.index];
                  return (
                    <li key={link.id} className="search-result-item" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}>
                      <div style={{ fontSize: '13px' }}>
                        <strong>{link.relation}</strong> → {getEntityName(link.target_id)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {incomingLinks.length > 0 && (
          <div className="inspector-section">
            <h4><Link2 size={14} /> Referenced by <span className="text-muted">({incomingLinks.length})</span></h4>
            <div ref={incomingScrollRef} style={{ overflow: 'auto', maxHeight: '300px' }}>
              <ul className="results-list" style={{ height: `${incomingVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {incomingVirtualizer.getVirtualItems().map(virtualItem => {
                  const link = incomingLinks[virtualItem.index];
                  return (
                    <li key={link.id} className="search-result-item" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}>
                      <div style={{ fontSize: '13px' }}>
                        {getEntityName(link.source_id)} → <strong>{link.relation}</strong>
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
