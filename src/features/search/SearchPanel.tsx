import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchKnowledge, semanticSearch, initEmbeddings, RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, X, Filter, Plus, Sparkles } from 'lucide-react';

interface SearchPanelProps {
  onClose?: () => void;
  isMobile?: boolean;
  onResultClick?: (result: SearchResult) => void;
  shouldAutoFocus?: boolean;
  ariaLabel?: string;
}

const FILTERS = ['All', 'Entities', 'Claims', 'Notes', 'Projects', 'People'] as const;
type FilterType = typeof FILTERS[number];

const FILTER_MAP: Record<FilterType, string | undefined> = {
  'All': undefined,
  'Entities': 'entity',
  'Claims': 'claim',
  'Notes': 'note',
  'Projects': 'project',
  'People': 'person',
};

const FilterBar: React.FC<{
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}> = ({ activeFilter, onFilterChange }) => (
  <div className="search-filters" role="group" aria-label="Search filters">
    <div className="filter-scroll">
      {FILTERS.map(filter => (
        <button
          key={filter}
          className={`filter-chip ${activeFilter === filter ? 'active' : ''}`}
          onClick={() => onFilterChange(filter)}
          aria-pressed={activeFilter === filter}
        >
          {filter}
        </button>
      ))}
    </div>
  </div>
);

const NoResultsState: React.FC<{ query: string; onClear: () => void }> = ({ query, onClear }) => (
  <div className="no-results-state">
    <div className="no-results-icon" aria-hidden="true">
      <Filter size={32} />
    </div>
    <h3>No local matches</h3>
    <p>We could not find anything matching &quot;{query}&quot; in your current library.</p>
    <div className="no-results-actions">
      <button className="btn-secondary" onClick={onClear}>
        Clear search
      </button>
      <button className="btn-primary">
        <Plus size={16} />
        Create new entity
      </button>
    </div>
  </div>
);

const SearchResultItem: React.FC<{
  result: SearchResult;
  index: number;
  isSelected: boolean;
  onResultClick?: (result: SearchResult) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  innerRef: (el: HTMLButtonElement | null) => void;
}> = ({ result, index, isSelected, onResultClick, onKeyDown, onMouseEnter, innerRef }) => (
  <li key={`${result.type}-${result.id}`} role="none">
    <button
      id={`result-${index}`}
      ref={innerRef}
      className={`search-result-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onResultClick?.(result)}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
    >
      <div className="result-meta">
        <span className="result-type">{result.type}</span>
        {result.stage && (
          <span className={`provenance-tag tag-${result.stage}`}>
            {result.stage}
          </span>
        )}
      </div>
      <div className="result-name">{result.title}</div>
      <div className="result-description">{result.content}</div>
    </button>
  </li>
);

const SearchPanel: React.FC<SearchPanelProps> = ({
  onClose,
  isMobile,
  onResultClick,
  shouldAutoFocus = false,
  ariaLabel
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [useSemantic, setUseSemantic] = useState(false);
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Programmatic focus instead of autoFocus prop (a11y best practice)
  useEffect(() => {
    if ((shouldAutoFocus || isMobile) && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [shouldAutoFocus, isMobile]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length <= 1) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }

      setIsSearching(true);
      try {
        const typeFilter = FILTER_MAP[activeFilter];
        const searchFn = useSemantic ? semanticSearch : searchKnowledge;
        const res = await searchFn(query, { type: typeFilter });
        setResults(res);
        setSelectedIndex(-1);
      } catch (err) {
        logger.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, activeFilter, useSemantic]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onResultClick?.(results[selectedIndex]);
    }
  }, [results, selectedIndex, onResultClick]);

  const handleItemKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    }
  }, [results.length]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current[selectedIndex]) {
      resultsRef.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
      resultsRef.current[selectedIndex]?.focus();
    }
  }, [selectedIndex]);

  return (
    <div
      className={`search-panel ${isMobile ? 'mobile-modal' : 'sidebar-panel'}`}
      role={isMobile ? "dialog" : undefined}
      aria-modal={isMobile ? "true" : undefined}
      aria-label={isMobile ? (ariaLabel || "Search") : undefined}
    >
      <div className="search-header">
        <div className="input-wrapper">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search knowledge..."
            aria-label="Search knowledge base"
            aria-controls="search-results-list"
            aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
          />
          {query && (
            <button
              className="input-clear-button"
              onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose} aria-label="Close search">
            <X size={20} />
          </button>
        )}
      </div>

      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <div className="search-mode-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`filter-chip ${!useSemantic ? 'active' : ''}`}
          onClick={() => setUseSemantic(false)}
          aria-pressed={!useSemantic}
        >
          Keyword
        </button>
        <button
          className={`filter-chip ${useSemantic ? 'active' : ''}`}
          onClick={async () => {
            if (!useSemantic) {
              setUseSemantic(true);
              // Trigger lazy model download on first use
              initEmbeddings();
            }
          }}
          aria-pressed={useSemantic}
        >
          <Sparkles size={12} style={{ marginRight: '4px' }} />
          Semantic
        </button>
      </div>

      <div className="search-results">
        <div aria-live="polite" role="status" className="sr-only">
          {isSearching ? 'Searching local records...' : ''}
          {!isSearching && query.length > 1 && results.length === 0 ? `No local matches found for ${query}` : ''}
          {!isSearching && results.length > 0 ? `Found ${results.length} local results` : ''}
        </div>

        {isSearching && <div className="searching-status">Searching local records...</div>}

        {!isSearching && query.length > 1 && results.length === 0 && (
          <NoResultsState query={query} onClear={() => setQuery('')} />
        )}

        {results.length > 0 && (
          <ul id="search-results-list" className="results-list" role="listbox" aria-label="Search results">
            {results.map((result, index) => (
              <SearchResultItem
                key={`${result.type}-${result.id}`}
                result={result}
                index={index}
                isSelected={selectedIndex === index}
                onResultClick={onResultClick}
                onKeyDown={handleItemKeyDown}
                onMouseEnter={() => setSelectedIndex(index)}
                innerRef={el => resultsRef.current[index] = el}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="search-footer">
        <span className="local-status">Offline ready</span>
      </div>
    </div>
  );
};

export default SearchPanel;
