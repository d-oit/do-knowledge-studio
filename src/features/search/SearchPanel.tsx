import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { progressiveSearch, initEmbeddings, type RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
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
  const [searchStages, setSearchStages] = useState<Set<string>>(new Set());
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 72;

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  // Programmatic focus instead of autoFocus prop (a11y best practice)
  useEffect(() => {
    if ((shouldAutoFocus || isMobile) && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [shouldAutoFocus, isMobile]);

  useEffect(() => {
    if (query.trim().length <= 1) {
      setResults([]);
      setSelectedIndex(-1);
      setSearchStages(new Set());
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchStages(new Set());
      perf.mark('search-query-start');

      const typeFilter = FILTER_MAP[activeFilter];
      const accumulated = new Map<string, RankedResult>();
      let firstBatch = true;

      const onStage: ProgressiveSearchCallback = (stageResults, stage) => {
        if (controller.signal.aborted) return;

        for (const r of stageResults) {
          accumulated.set(r.id, r);
        }

        setSearchStages(prev => new Set(prev).add(stage));
        const flatResults = Array.from(accumulated.values()).map(r => ({
          id: r.id,
          title: r.name,
          type: r.type,
          content: r.excerpt,
          stage: r.stage || stage,
        }));
        setResults(flatResults);

        if (firstBatch) {
          perf.measure('search-first-result', 'search-query-start');
          firstBatch = false;
        }
        setIsSearching(false);
      };

      try {
        await progressiveSearch(query, onStage, { type: typeFilter, signal: controller.signal });
      } catch (err) {
        logger.error('Search failed', err);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
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
              initEmbeddings();
            }
          }}
          aria-pressed={useSemantic}
        >
          <Sparkles size={12} style={{ marginRight: '4px' }} />
          Semantic
        </button>
      </div>

      {searchStages.size > 0 && (
        <div className="search-progress" style={{ padding: '4px 16px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <span className={searchStages.has('exact') ? 'stage-done' : 'stage-pending'}>{'\u2713'} Keywords</span>
          {searchStages.has('semantic') ? <span className="stage-done">{'\u2713'} Semantic</span> : <span className="stage-pending">{'\u2022'} Semantic</span>}
          {searchStages.has('related') ? <span className="stage-done">{'\u2713'} Related</span> : <span className="stage-pending">{'\u2022'} Related</span>}
        </div>
      )}

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
          <div ref={scrollRef} style={{ overflow: 'auto', flex: 1 }}>
            <ul
              id="search-results-list"
              className="results-list"
              role="listbox"
              aria-label="Search results"
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const index = virtualItem.index;
                const result = results[index];
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <SearchResultItem
                      result={result}
                      index={index}
                      isSelected={selectedIndex === index}
                      onResultClick={onResultClick}
                      onKeyDown={handleItemKeyDown}
                      onMouseEnter={() => setSelectedIndex(index)}
                      innerRef={el => resultsRef.current[index] = el}
                    />
                  </div>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <div className="search-footer">
        <span className="local-status">Offline ready</span>
      </div>
    </div>
  );
};

export default SearchPanel;
