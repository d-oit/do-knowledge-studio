import React, { useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import { Entity } from '../../lib/validation';
import VersionHistoryPanel from './VersionHistoryPanel';

interface EntityBacklinksProps {
  backlinks: Entity[];
}

/**
 * Read-only list of entities that link TO the current entity.
 *
 * Rendered as a compact "Referenced by (n)" list inside the editor
 * sidebar. Returns `null` when the supplied `backlinks` array is
 * empty so the section can disappear cleanly.
 */
export const EntityBacklinks: React.FC<EntityBacklinksProps> = ({ backlinks }) => {
  if (backlinks.length === 0) return null;
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

interface EntityVersionSectionProps {
  entityId: string;
  editor: { commands: { setContent: (content: string) => void } } | null;
  onLoaded: (entity: Entity) => void;
}

/**
 * Collapsible section that hosts the {@link VersionHistoryPanel} for
 * the current entity.
 *
 * The disclosure toggle uses `aria-expanded` for assistive tech.
 * Restoring a version fires `onLoaded(entity)` so the parent can
 * re-push the new content into the TipTap editor.
 */
export const EntityVersionSection: React.FC<EntityVersionSectionProps> = ({ entityId, editor, onLoaded }) => {
  const repository = useRepository();
  const [open, setOpen] = useState(false);

  const handleRestore = async () => {
    try {
      const entity = await repository.getEntityById(entityId);
      if (entity) {
        onLoaded(entity);
        if (editor && entity.description) editor.commands.setContent(entity.description);
      }
    } catch (err) {
      logger.error('Failed to reload entity after restore', { error: err });
    }
  };

  return (
    <div style={{ marginTop: '16px', padding: '8px 0' }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); }}
        className="advanced-toggle"
        aria-expanded={open}
        aria-label="Toggle version history"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 0',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '12px',
          minHeight: '44px',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <History size={14} aria-hidden="true" />
        Version History
      </button>
      {open && <VersionHistoryPanel entityId={entityId} onRestore={() => { void handleRestore(); }} />}
    </div>
  );
};
