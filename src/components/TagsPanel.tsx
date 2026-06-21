import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import type { Tag as TagType } from '../../lib/validation';
import type { TagWithCount } from '../../db/repository/tags';

interface TagsPanelProps {
  entityId?: string;
  onTagsChange?: (tags: TagType[]) => void;
}

const TAG_COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6366f1',
];

export const TagsPanel: React.FC<TagsPanelProps> = ({ entityId, onTagsChange }) => {
  const repository = useRepository();
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [entityTags, setEntityTags] = useState<TagType[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      const tags = await repository.getAllTags();
      setAllTags(tags);
    } catch (err) {
      logger.error('Failed to load tags', err);
    }
  }, [repository]);

  const loadEntityTags = useCallback(async () => {
    if (!entityId) return;
    try {
      const tags = await repository.getTagsByEntityId(entityId);
      setEntityTags(tags);
    } catch (err) {
      logger.error('Failed to load entity tags', err);
    }
  }, [entityId, repository]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    void loadEntityTags();
  }, [loadEntityTags]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreating(true);
    try {
      const tag = await repository.createTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0]);
      await loadTags();
      if (entityId) {
        await repository.addTagToEntity(entityId, tag.id);
        await loadEntityTags();
        onTagsChange?.([...entityTags, tag]);
      }
    } catch (err) {
      logger.error('Failed to create tag', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleTag = async (tag: TagType) => {
    if (!entityId || !tag.id) return;
    const isApplied = entityTags.some(t => t.id === tag.id);
    try {
      if (isApplied) {
        await repository.removeTagFromEntity(entityId, tag.id);
      } else {
        await repository.addTagToEntity(entityId, tag.id);
      }
      await loadEntityTags();
      onTagsChange?.(isApplied ? entityTags.filter(t => t.id !== tag.id) : [...entityTags, tag]);
    } catch (err) {
      logger.error('Failed to toggle tag', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await repository.deleteTag(tagId);
      await loadTags();
      if (entityId) {
        await loadEntityTags();
      }
    } catch (err) {
      logger.error('Failed to delete tag', err);
    }
  };

  return (
    <div className="tags-panel">
      <div className="tags-header">
        <Tag size={16} />
        <span>Tags</span>
      </div>

      {entityId && (
        <div className="tags-current">
          {entityTags.length === 0 ? (
            <span className="tags-empty">No tags applied</span>
          ) : (
            entityTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className="tag-chip active"
                style={{ borderColor: tag.color || 'var(--interactive-primary)' }}
                onClick={() => void handleToggleTag(tag)}
                aria-label={`Remove tag ${tag.name}`}
              >
                <span className="tag-dot" style={{ background: tag.color || 'var(--interactive-primary)' }} />
                {tag.name}
                <X size={12} />
              </button>
            ))
          )}
        </div>
      )}

      <div className="tags-available">
        <span className="tags-section-label">Available Tags</span>
        <div className="tags-list">
          {allTags.map(tag => (
            <button
              type="button"
              key={tag.id}
              className={`tag-chip ${entityTags.some(t => t.id === tag.id) ? 'active' : ''}`}
              style={{ borderColor: tag.color || 'var(--border-default)' }}
              onClick={() => void handleToggleTag(tag)}
            >
              <span className="tag-dot" style={{ background: tag.color || 'var(--text-muted)' }} />
              {tag.name}
              <span className="tag-count">{tag.entity_count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tags-create">
        <input
          type="text"
          value={newTagName}
          onChange={e => { setNewTagName(e.target.value); }}
          placeholder="New tag name..."
          onKeyDown={e => { if (e.key === 'Enter') void handleCreateTag(); }}
          aria-label="New tag name"
        />
        <div className="tag-color-picker">
          {TAG_COLORS.map(color => (
            <button
              type="button"
              key={color}
              className={`tag-color-swatch ${newTagColor === color ? 'selected' : ''}`}
              style={{ background: color }}
              onClick={() => { setNewTagColor(color); }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleCreateTag()}
          disabled={isCreating || !newTagName.trim()}
          aria-label="Create new tag"
        >
          <Plus size={14} />
          Create
        </button>
      </div>
    </div>
  );
};

export default TagsPanel;
