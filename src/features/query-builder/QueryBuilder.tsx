import React, { useState, useCallback, useEffect } from 'react';
import { Search, Plus, X, Filter, Tag, Link2, FileText, ShieldCheck, Play, Loader2 } from 'lucide-react';
import { buildQueryFromFilters, generateFilterId, type QueryFilter } from '../../lib/query-builder';
import { searchKnowledge } from '../../lib/search';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';
import type { RankedResult } from '../../db/repository';

interface QueryBuilderProps {
  onClose: () => void;
  onResultClick?: (result: RankedResult) => void;
}

const FILTER_TYPES = [
  { type: 'entity-type' as const, label: 'Entity Type', icon: FileText, options: ['concept', 'person', 'org', 'tech', 'note', 'project'] },
  { type: 'relation' as const, label: 'Relation', icon: Link2, options: [] },
  { type: 'tag' as const, label: 'Tag', icon: Tag, options: [] },
  { type: 'verification' as const, label: 'Verification', icon: ShieldCheck, options: ['unverified', 'verified', 'disputed'] },
  { type: 'text' as const, label: 'Text Search', icon: Search, options: [] },
];

const QueryBuilder: React.FC<QueryBuilderProps> = ({ onClose, onResultClick }) => {
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relations, setRelations] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    Promise.all([
      repository.getAllLinks().then(links => {
        const unique = [...new Set(links.map(l => l.relation))];
        setRelations(unique);
      }),
      repository.getAllTags().then(t => {
        setTags(t.map(tag => tag.name));
      }),
    ]).catch(err => { logger.warn('Failed to load filter options', err); });
  }, []);

  const addFilter = useCallback((type: QueryFilter['type'], value: string) => {
    if (!value) return;
    setFilters(prev => [...prev, { id: generateFilterId(), type, value, operator: 'and' }]);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const toggleOperator = useCallback((id: string) => {
    setFilters(prev => prev.map(f =>
      f.id === id ? { ...f, operator: f.operator === 'and' ? 'or' : 'and' } : f
    ));
  }, []);

  const handleAddTextFilter = useCallback(() => {
    if (textInput.trim()) {
      addFilter('text', textInput.trim());
      setTextInput('');
    }
  }, [textInput, addFilter]);

  const handleRunQuery = useCallback(async () => {
    const query = buildQueryFromFilters(filters);
    if (!query.text) return;

    setIsSearching(true);
    try {
      const searchResults = await searchKnowledge(query.text, { limit: 20 });
      setResults(searchResults);
    } catch (err) {
      logger.error('Query failed', err);
    } finally {
      setIsSearching(false);
    }
  }, [filters]);

  const query = buildQueryFromFilters(filters);

  return (
    <div className="query-builder" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px', maxWidth: '100vw',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
      zIndex: 'var(--z-overlay)', display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} />
          <h3 style={{ margin: 0 }}>Query Builder</h3>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Active Filters */}
        {filters.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {filters.map((filter, i) => {
                const ft = FILTER_TYPES.find(f => f.type === filter.type);
                const Icon = ft?.icon ?? Filter;
                return (
                  <React.Fragment key={filter.id}>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleOperator(filter.id)}
                        style={{
                          padding: '4px 8px', borderRadius: '12px', border: 'none',
                          background: filter.operator === 'and' ? 'var(--interactive-primary-subtle)' : 'var(--entity-person-bg)',
                          color: filter.operator === 'and' ? 'var(--interactive-primary)' : 'var(--entity-person-text)',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase',
                        }}
                      >
                        {filter.operator}
                      </button>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: '16px', fontSize: '12px',
                      background: 'var(--entity-concept-bg)', color: 'var(--entity-concept-text)',
                    }}>
                      <Icon size={12} />
                      {filter.value}
                      <button type="button" onClick={() => removeFilter(filter.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '2px', color: 'inherit',
                      }} aria-label={`Remove ${filter.value}`}>
                        <X size={10} />
                      </button>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {query.description}
            </div>
          </div>
        )}

        {/* Add Filter Buttons */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>Add Filter</h4>
          {FILTER_TYPES.map(ft => {
            const Icon = ft.icon;
            return (
              <div key={ft.type} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon size={12} /> {ft.label}
                </div>
                {ft.type === 'text' ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      value={textInput}
                      onChange={e => { setTextInput(e.target.value); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTextFilter(); }}
                      placeholder="Search text..."
                      style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '12px' }}
                    />
                    <button type="button" onClick={handleAddTextFilter} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(ft.type === 'relation' ? relations : ft.type === 'tag' ? tags : ft.options).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => addFilter(ft.type, opt)}
                        className="filter-chip"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Run Query Button */}
        <button
          type="button"
          onClick={() => void handleRunQuery()}
          disabled={filters.length === 0 || isSearching}
          className="primary"
          style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {isSearching ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          {isSearching ? 'Searching...' : `Run Query (${filters.length} filters)`}
        </button>

        {/* Results */}
        {results.length > 0 && (
          <div>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Results ({results.length})
            </h4>
            {results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => onResultClick?.(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                  border: '1px solid var(--border-default)', borderRadius: '8px', marginBottom: '6px',
                  background: 'var(--bg-base)', cursor: 'pointer', fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '8px', background: 'var(--entity-concept-bg)', color: 'var(--entity-concept-text)' }}>{r.type}</span>
                  <strong>{r.title}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.content}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryBuilder;
