import React from 'react';
import type { Entity } from '../../lib/validation';

interface BacklinksPanelProps {
  backlinks: Entity[];
  editingEntityId?: string | null;
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ backlinks, editingEntityId }) => {
  if (!editingEntityId || backlinks.length === 0) return null;

  return (
    <div className="backlinks-section" style={{ marginTop: '16px', padding: '8px 0' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
        Referenced by ({backlinks.length})
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {backlinks.map(bl => (
          <li key={bl.id} style={{ padding: '4px 0', fontSize: '13px' }}>
            <span style={{ color: 'var(--interactive-primary)', cursor: 'default' }}>{bl.name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({bl.type})</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BacklinksPanel;
