import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SortAsc, SortDesc, Calendar, BookOpen, User, Lightbulb, Briefcase, ExternalLink } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Entity } from '../../lib/validation';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import { stripHtmlTags } from '../../lib/security';

interface LibraryViewProps {
  onEditEntity: (entityId: string) => void;
}

const ENTITY_TYPES = [
  { value: 'all', label: 'All', icon: <BookOpen size={14} /> },
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
    } catch {
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

        <div className="library-controls">
          <div className="search-box">
            <Search className="search-icon" size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search library"
            />
          </div>

          <div className="filter-chips" role="group" aria-label="Filter by type">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type.value}
                className={`filter-chip ${filterType === type.value ? 'active' : ''}`}
                onClick={() => setFilterType(type.value)}
                aria-pressed={filterType === type.value}
              >
                {type.icon}
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          <div className="sort-controls">
            <div className="sort-field-select">
              <Calendar size={14} aria-hidden="true" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at' | 'updated_at')}
                aria-label="Sort by"
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
              aria-label={sortOrder === 'ASC' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortOrder === 'ASC' ? <SortAsc size={18} aria-hidden="true" /> : <SortDesc size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div className="library-content">
        <div aria-live="polite" role="status" className="sr-only">
          {isLoading ? 'Loading entities...' : ''}
          {!isLoading && entities.length === 0 ? 'No entities found matching your filters.' : ''}
          {!isLoading && entities.length > 0 ? `Showing ${entities.length} entities.` : ''}
        </div>

        <div className="entity-grid-header">
           <div className="col-name">Name</div>
           <div className="col-type">Type</div>
           <div className="col-date">Updated</div>
           <div className="col-actions"></div>
        </div>

        <div
          ref={parentRef}
          className="virtual-list-container"
          style={{
            height: `calc(100vh - 280px)`,
            overflow: 'auto',
          }}
        >
          {isLoading ? (
            <div className="library-loading">Loading entities...</div>
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
                  <button
                    key={virtualItem.key}
                    className="entity-list-row"
                    type="button"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    onClick={() => entity.id && onEditEntity(entity.id)}
                    aria-label={`Edit ${entity.name}`}
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
                       <span className="icon-button" aria-hidden="true">
                          <ExternalLink size={16} />
                       </span>
                    </div>
                  </button>
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
