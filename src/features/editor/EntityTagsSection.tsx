import React, { useState, useEffect } from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import type { Tag } from '../../lib/validation';
import type { TagWithCount } from '../../db/repository/tags';

const TAG_COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6366f1',
] as const;

interface EntityTagsSectionProps {
  entityId: string;
}

/**
 * Compact tag chip editor embedded in the editor sidebar.
 *
 * Loads the global tag catalog and the subset already applied to the
 * entity. Toggling a chip calls `addTagToEntity` or `removeTagFromEntity`
 * on the repository. "New tag" opens an inline form with a name
 * input and a 10-color palette; the created tag is automatically
 * applied to the current entity.
 */
export const EntityTagsSection: React.FC<EntityTagsSectionProps> = ({ entityId }) => {
  const repository = useRepository();
  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[0]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [tags, current] = await Promise.all([
          repository.getAllTags(),
          repository.getTagsByEntityId(entityId),
        ]);
        if (cancelled) return;
        setAllTags(tags);
        setEntityTags(current);
      } catch (err) {
        logger.error('Failed to load tags', err);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, repository]);

  const handleToggle = async (tag: Tag) => {
    if (!tag.id) return;
    const applied = entityTags.some(t => t.id === tag.id);
    try {
      if (applied) {
        await repository.removeTagFromEntity(entityId, tag.id);
        setEntityTags(prev => prev.filter(t => t.id !== tag.id));
      } else {
        await repository.addTagToEntity(entityId, tag.id);
        setEntityTags(prev => [...prev, tag]);
      }
    } catch (err) {
      logger.error('Failed to toggle tag', err);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const tag = await repository.createTag(name, newColor);
      await repository.addTagToEntity(entityId, tag.id);
      const refreshed = await repository.getAllTags();
      setAllTags(refreshed);
      setEntityTags(prev => [...prev, tag]);
      setNewName('');
      setNewColor(TAG_COLORS[0]);
      setShowCreate(false);
    } catch (err) {
      logger.error('Failed to create tag', err);
    }
  };

  return (
    <div className="entity-tags-section" style={{ marginTop: '16px', padding: '8px 0' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <TagIcon size={14} aria-hidden="true" />
        Tags
      </h4>

      <div className="tags-current" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px', marginBottom: '8px' }}>
        {entityTags.length === 0 ? (
          <span className="tags-empty" style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>No tags applied</span>
        ) : (
          entityTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              className="tag-chip active"
              style={{ borderColor: tag.color ?? 'var(--interactive-primary)' }}
              onClick={() => void handleToggle(tag)}
              aria-label={`Remove tag ${tag.name}`}
            >
              <span className="tag-dot" style={{ background: tag.color ?? 'var(--interactive-primary)' }} />
              {tag.name}
              <X size={12} />
            </button>
          ))
        )}
      </div>

      {showCreate ? (
        <div className="tags-create" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newName}
            onChange={e => { setNewName(e.target.value); }}
            placeholder="New tag name..."
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
            aria-label="New tag name"
            style={{ flex: 1, minWidth: '120px', padding: '4px 8px', fontSize: '13px' }}
          />
          <div className="tag-color-picker" style={{ display: 'flex', gap: '4px' }}>
            {TAG_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className={`tag-color-swatch ${newColor === color ? 'selected' : ''}`}
                style={{ background: color, width: '20px', height: '20px', borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer' }}
                onClick={() => { setNewColor(color); }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleCreate()}
            disabled={!newName.trim()}
            style={{ padding: '4px 10px', fontSize: '12px', minHeight: '32px' }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowCreate(false); setNewName(''); }}
            style={{ padding: '4px 10px', fontSize: '12px', minHeight: '32px' }}
            aria-label="Cancel create tag"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {allTags.filter(t => !entityTags.some(c => c.id === t.id)).slice(0, 8).map(tag => (
            <button
              key={tag.id}
              type="button"
              className="tag-chip"
              style={{ borderColor: tag.color ?? 'var(--border-default)' }}
              onClick={() => void handleToggle(tag)}
              aria-label={`Apply tag ${tag.name}`}
            >
              <span className="tag-dot" style={{ background: tag.color ?? 'var(--text-muted)' }} />
              {tag.name}
            </button>
          ))}
          <button
            type="button"
            className="add-tag-btn"
            onClick={() => { setShowCreate(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-full)', background: 'transparent', cursor: 'pointer', minHeight: '32px' }}
            aria-label="Create new tag"
          >
            <Plus size={12} />
            New tag
          </button>
        </div>
      )}
    </div>
  );
};

export default EntityTagsSection;
