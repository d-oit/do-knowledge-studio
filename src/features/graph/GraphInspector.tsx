import React, { useMemo } from 'react';
import { X, ExternalLink, Info, ShieldCheck } from 'lucide-react';
import { Entity, Claim, Link } from '../../lib/validation';

interface GraphInspectorProps {
  entity: Entity;
  claims: Claim[];
  links: Link[];
  entities: Entity[];
  onClose: () => void;
}

const GraphInspector: React.FC<GraphInspectorProps> = ({
  entity,
  claims,
  links,
  entities,
  onClose
}) => {
  const outgoingLinks = useMemo(() =>
    links.filter(l => l.source_id === entity.id),
    [links, entity.id]
  );

  const incomingLinks = useMemo(() =>
    links.filter(l => l.target_id === entity.id),
    [links, entity.id]
  );

  const getEntityName = (id: string) =>
    entities.find(e => e.id === id)?.name || 'Unknown Entity';

  return (
    <aside className="inspector-panel" aria-label={`Details for ${entity.name}`}>
      <div className="inspector-header">
        <h3>{entity.name}</h3>
        <button className="close-button" onClick={onClose} aria-label="Close inspector">
          <X size={18} />
        </button>
      </div>

      <div className="inspector-content">
        <div className="inspector-section">
          <div className="result-type">{entity.type}</div>
          {entity.description && (
            <p className="result-description">{entity.description}</p>
          )}
        </div>

        {claims.length > 0 && (
          <div className="inspector-section">
            <h4><ShieldCheck size={14} /> Claims</h4>
            <ul className="results-list">
              {claims.map(claim => (
                <li key={claim.id} className="search-result-item">
                  <div className="msg-text" style={{ fontSize: '13px' }}>{claim.statement}</div>
                  {claim.evidence && (
                    <div className="result-meta" style={{ marginTop: '4px' }}>
                      <span className="provenance-tag">Evidence: {claim.evidence}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(outgoingLinks.length > 0 || incomingLinks.length > 0) && (
          <div className="inspector-section">
            <h4><ExternalLink size={14} /> Relationships</h4>
            <ul className="results-list">
              {outgoingLinks.map(link => (
                <li key={link.id} className="search-result-item">
                  <div style={{ fontSize: '13px' }}>
                    <strong>{link.relation}</strong> → {getEntityName(link.target_id)}
                  </div>
                </li>
              ))}
              {incomingLinks.map(link => (
                <li key={link.id} className="search-result-item">
                  <div style={{ fontSize: '13px' }}>
                    {getEntityName(link.source_id)} → <strong>{link.relation}</strong>
                  </div>
                </li>
              ))}
            </ul>
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
