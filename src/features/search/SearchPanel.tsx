import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchKnowledge, RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, X, Filter, Plus } from 'lucide-react';

interface SearchPanelProps {
  onClose?: () => void;
  isMobile?: boolean;
  onResultClick?: (result: RankedResult) => void;
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
    <p>We couldn&apos;t find anything matching &quot;{query}&quot; in your current library.</p>
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
  result: RankedResult;
  index: number;
  isSelected: boolean;
  onResultClick?: (result: RankedResult) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  innerRef: (el: HTMLButtonElement | null) => void;
}> = ({ result, index, isSelected, onResultClick, onKeyDown, onMouseEnter, innerRef }) => (
  <li key={`${result.type}-${result.id}`}>
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
        <span className={`provenance-tag tag-${result.stage}`}>
          {result.stage}
        </span>
      </div>
      <div className="result-name">{result.name}</div>
      <div className="result-description">{result.excerpt}</div>
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
  const [results, setResults] = useState<RankedResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const performSearch = async () => {
        if (query.trim().length <= 1) {
          setResults([]);
          setSelectedIndex(-1);
          return;
        }

        setIsSearching(true);
        try {
          const typeFilter = FILTER_MAP[activeFilter];
          const res = await searchKnowledge(query, { type: typeFilter });
          setResults(res);
          setSelectedIndex(-1);
        } catch (err) {
          logger.error('Search failed', err);
        } finally {
          setIsSearching(false);
        }
      };
      void performSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, activeFilter]);

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
            type="search"
            autoFocus={shouldAutoFocus || isMobile}
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
              className="clear-button icon-button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
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

      <div className="search-results">
        <div aria-live="polite" className="sr-only">
          {isSearching ? 'Searching local records...' : ''}
          {!isSearching && query.length > 1 && results.length === 0 ? `No local matches found for ${query}` : ''}
          {!isSearching && results.length > 0 ? `Found ${results.length} local results` : ''}
        </div>

        {isSearching && <div className="searching-status" aria-hidden="true">Searching local records...</div>}

        {!isSearching && query.length > 1 && results.length === 0 && (
          <NoResultsState query={query} onClear={() => setQuery('')} />
        )}

        {results.length > 0 && (
          <ul id="search-results-list" className="results-list" aria-label="Search results" role="listbox">
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
