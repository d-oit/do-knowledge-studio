import React, { useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Entity } from '../../lib/validation';
import { EntityExtractionResult } from '../../lib/ai/entity-extractor';

interface MentionMenuProps {
  isLoading: boolean;
  error: string | null;
  entities: Entity[];
  onSelect: (target: Entity) => void;
  onClose: () => void;
}

export const MentionMenu: React.FC<MentionMenuProps> = ({ isLoading, error, entities, onSelect, onClose }) => {
  "use no memo";
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is stable; component opts out of React Compiler via "use no memo"
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <div className="mention-section" style={{ marginTop: '16px' }}>
      <h4 className="block text-sm font-medium mb-2">Link to Entity</h4>
      <div
        ref={parentRef}
        className="mention-list-container"
        style={{
          maxHeight: '300px',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {isLoading && <div className="text-sm text-muted animate-pulse">Loading...</div>}
        {error && <div className="text-sm text-error">{error}</div>}
        {!isLoading && !error && entities.length === 0 && <div className="text-sm text-muted">No entities found</div>}
        {!isLoading && !error && entities.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entity = entities[virtualRow.index];
              if (!entity) return null;
              return (
                <button
                  type="button"
                  key={virtualRow.key}
                  onClick={() => {
                    onSelect(entity);
                    onClose();
                  }}
                  className="mention-item w-full text-left px-3 py-2 rounded border border-muted hover:bg-muted"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {entity.name} ({entity.type})
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


interface BacklinksListProps {
  backlinks: Entity[];
}

export const BacklinksList: React.FC<BacklinksListProps> = ({ backlinks }) => (
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


interface LinkInputProps {
  value: string;
  onChange: (val: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const LinkInput: React.FC<LinkInputProps> = ({ value, onChange, onApply, onCancel }) => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0', marginBottom: '8px' }}>
    <input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://..."
      onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
      style={{ flex: 1, padding: '6px 8px', fontSize: '13px' }}
      aria-label="Link URL"
    />
    <button type="button" onClick={onApply} style={{ padding: '6px 12px', fontSize: '13px' }}>Apply</button>
    <button type="button" onClick={onCancel} style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
  </div>
);


interface ExtractionNoticeProps {
  result: EntityExtractionResult;
  onReview: () => void;
  onDismiss: () => void;
}

export const ExtractionNotice: React.FC<ExtractionNoticeProps> = ({ result, onReview, onDismiss }) => (
  <div style={{
    marginTop: '16px',
    padding: '12px 16px',
    background: 'var(--interactive-primary-subtle)',
    borderRadius: '8px',
    border: '1px solid var(--interactive-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
      <Sparkles size={16} style={{ color: 'var(--interactive-primary)' }} />
      <span>
        AI found <strong>{result.entities.length} entities</strong> and <strong>{result.relationships.length} relationships</strong> in this note.
      </span>
    </div>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button type="button"
        onClick={onReview}
        className="primary"
        style={{ padding: '4px 12px', fontSize: '12px', minHeight: '32px' }}
      >
        Review
      </button>
      <button type="button"
        onClick={onDismiss}
        style={{ padding: '4px 8px', fontSize: '12px', minHeight: '32px', background: 'transparent', border: 'none' }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  </div>
);
