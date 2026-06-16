import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SortAsc, SortDesc, Calendar, BookOpen, User, Lightbulb, Briefcase, ExternalLink, Layers, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Entity } from '../../lib/validation';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import { stripHtmlTags } from '../../lib/security';

interface LibraryViewProps {
  onEditEntity: (entityId: string) => void;
}

const ENTITY_TYPES = [
  { value: 'all', label: 'All', icon: <Layers size={14} /> },
  { value: 'note', label: 'Note', icon: <BookOpen size={14} /> },
  { value: 'concept', label: 'Concept', icon: <Lightbulb size={14} /> },
  { value: 'person', label: 'Person', icon: <User size={14} /> },
  { value: 'project', label: 'Project', icon: <Briefcase size={14} /> },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
] as const;

export const LibraryView: React.FC<LibraryViewProps> = ({ onEditEntity }) => {
  "use no memo"; // opt out of React Compiler — useVirtualizer returns non-memoizable functions
  const repository = useRepository();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'updated_at'>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const parentRef = useRef<HTMLDivElement>(null);

  const loadEntities = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await repository.getEntities({
        search: search.trim() || undefined,
        type: filterType === 'all' ? undefined : filterType,
        sortBy,
        sortOrder,
      });
      setEntities(results);
    } catch (err) {
      logger.error('Failed to load entities in Library', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterType, sortBy, sortOrder, repository]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEntities();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadEntities]);

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is stable; component opts out of React Compiler via "use no memo"
  const rowVirtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (err) {
      logger.debug('Failed to format date', { dateStr, error: err });
      return dateStr;
    }
  };

  return (
    <div className="library-view">
      <div className="library-header">
        <div className="library-title-row">
          <h2 className="serif-heading">Library</h2>
          <div className="library-stats">{entities.length} entities</div>
        </div>

        <div className="library-controls motion-stagger-2" key={`library-controls-${filterType}-${sortBy}-${sortOrder}`}>
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-chips">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type.value}
                className={`filter-chip ${filterType === type.value ? 'active' : ''}`}
                onClick={() => setFilterType(type.value)}
              >
                {type.icon}
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          <div className="sort-controls">
            <div className="sort-field-select">
              <Calendar size={14} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at' | 'updated_at')}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              className="sort-order-btn"
              onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
              title={sortOrder === 'ASC' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortOrder === 'ASC' ? <SortAsc size={18} /> : <SortDesc size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div className="library-content">
        <div className="entity-grid-header">
           <div className="col-name">Name</div>
           <div className="col-type">Type</div>
           <div className="col-date">Updated</div>
           <div className="col-actions"></div>
        </div>

        <div
          ref={parentRef}
          className="virtual-list-container"
        >
          {isLoading ? (
            <div className="library-loading" role="status" aria-live="polite">
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span>Loading entities...</span>
            </div>
          ) : entities.length === 0 ? (
            <div className="library-empty">
              <BookOpen size={48} />
              <p>No entities found matching your filters.</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const entity = entities[virtualItem.index];
                if (!entity) return null;

                return (
                  <div
                    key={virtualItem.key}
                    className="entity-list-row"
                    role="button"
                    tabIndex={0}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    onClick={() => entity.id && onEditEntity(entity.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && entity.id) {
                        e.preventDefault();
                        onEditEntity(entity.id);
                      }
                    }}
                  >
                    <div className="col-name">
                      <span className="entity-name-text">{entity.name}</span>
                      {entity.description && (
                         <span className="entity-description-preview">
                           {stripHtmlTags(entity.description).substring(0, 80)}...
                         </span>
                      )}
                    </div>
                    <div className="col-type">
                      <span className={`type-badge type-${entity.type}`}>
                        {entity.type}
                      </span>
                    </div>
                    <div className="col-date">
                      {formatDate(entity.updated_at)}
                    </div>
                    <div className="col-actions">
                       <button className="icon-button" aria-label="Open in editor">
                          <ExternalLink size={16} />
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryView;

