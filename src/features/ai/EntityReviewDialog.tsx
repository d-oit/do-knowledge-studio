import { useState } from 'react';
import type { FC } from 'react';
import { X, CheckCircle2, Link2, PlusCircle } from 'lucide-react';
import type { EntityExtractionResult } from '../../lib/ai/entity-extractor';
import { useRepository } from '../../db/useRepository';
import { applyEntitiesToGraph } from '../../lib/ai/graph-linker';
import { logger } from '../../lib/logger';

interface EntityReviewDialogProps {
  result: EntityExtractionResult;
  sourceNoteId?: string;
  onClose: () => void;
  onComplete: () => void;
}

const EntityReviewDialog: FC<EntityReviewDialogProps> = ({
  result,
  sourceNoteId,
  onClose,
  onComplete,
}) => {
  const repository = useRepository();
  const [selectedEntities, setSelectedEntities] = useState<string[]>(
    result.entities.map(e => e.name)
  );
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>(
    result.relationships.map(r => `${r.from}->${r.to}`)
  );
  const [isApplying, setIsApplying] = useState(false);

  const toggleEntity = (name: string) => {
    setSelectedEntities(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleRelationship = (from: string, to: string) => {
    const key = `${from}->${to}`;
    setSelectedRelationships(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await applyEntitiesToGraph(
        result,
        repository,
        selectedEntities,
        selectedRelationships,
        sourceNoteId
      );
      onComplete();
      onClose();
    } catch (err) {
      logger.error('Failed to apply entities to graph', err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="modal-overlay"
    >
      <div
        className="modal-content"
        style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
      >
        <div className="inspector-header">
          <h3 id="review-dialog-title"><PlusCircle size={18} /> Review Extracted Entities</h3>
          <button type="button" className="close-button" onClick={() => { onClose(); }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', padding: '16px', flex: 1 }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            AI analyzed your note and found the following entities and relationships.
            Select the ones you want to add to your knowledge graph.
          </p>

          <section style={{ marginBottom: '24px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '14px' }}>
              <CheckCircle2 size={16} /> Entities ({result.entities.length})
            </h4>
            <div className="entity-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.entities.map((entity, idx) => (
                <div key={entity.name} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  background: selectedEntities.includes(entity.name) ? 'var(--bg-surface-active)' : 'transparent'
                }}>
                  <input
                    id={`entity-check-${idx}`}
                    type="checkbox"
                    checked={selectedEntities.includes(entity.name)}
                    onChange={() => { toggleEntity(entity.name); }}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <label htmlFor={`entity-check-${idx}`} style={{ cursor: 'pointer', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{entity.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--interactive-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>{entity.type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{entity.description}</div>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '14px' }}>
              <Link2 size={16} /> Relationships ({result.relationships.length})
            </h4>
            <div className="relationship-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.relationships.map((rel, idx) => {
                const key = `${rel.from}->${rel.to}`;
                return (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    background: selectedRelationships.includes(key) ? 'var(--bg-surface-active)' : 'transparent'
                  }}>
                    <input
                      id={`rel-check-${idx}`}
                      type="checkbox"
                      checked={selectedRelationships.includes(key)}
                      onChange={() => { toggleRelationship(rel.from, rel.to); }}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor={`rel-check-${idx}`} style={{ fontSize: '13px', cursor: 'pointer', flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{rel.from}</span>
                      <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>— {rel.label} →</span>
                      <span style={{ fontWeight: 600 }}>{rel.to}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="modal-actions" style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
          <button type="button" onClick={() => onClose()} disabled={isApplying}>Cancel</button>
          <button
            type="button"
            onClick={() => { void handleApply(); }}
            className="primary"
            disabled={isApplying || (selectedEntities.length === 0 && selectedRelationships.length === 0)}
          >
            {isApplying ? 'Adding...' : `Add Selected to Graph (${selectedEntities.length + selectedRelationships.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntityReviewDialog;
