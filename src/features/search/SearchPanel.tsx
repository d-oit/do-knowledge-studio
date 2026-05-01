import React, { useState, useEffect, useRef } from 'react';
import { searchKnowledge, RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, X } from 'lucide-react';

interface SearchPanelProps {
  onClose?: () => void;
  isMobile?: boolean;
  onResultClick?: (result: RankedResult) => void;
  ariaLabel?: string;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onClose, isMobile, onResultClick, ariaLabel }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const resultsRef = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setIsSearching(true);
        try {
          const res = await searchKnowledge(query);
          setResults(res);
          setSelectedIndex(-1);
        } catch (err) {
          logger.error('Search failed', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
        setSelectedIndex(-1);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        onResultClick?.(results[selectedIndex]);
      }
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onResultClick?.(results[index]);
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current[selectedIndex]) {
      resultsRef.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
      });
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
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search knowledge base..."
            aria-label="Search knowledge base"
            aria-controls="search-results-list"
            aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
          />
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose} aria-label="Close search">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="search-results">
        <div aria-live="polite" className="sr-only">
          {isSearching ? 'Searching...' : ''}
          {!isSearching && query.length > 1 && results.length === 0 ? `No matches found for ${query}` : ''}
          {!isSearching && results.length > 0 ? `Found ${results.length} results` : ''}
        </div>

        {isSearching && <div className="searching-status" aria-hidden="true">Searching...</div>}
        {!isSearching && query.length > 1 && results.length === 0 && (
          <div className="no-results" aria-hidden="true">No matches found for "{query}"</div>
        )}

        {results.length > 0 && (
          <ul
            id="search-results-list"
            className="results-list"
            aria-label="Search results"
            role="listbox"
          >
            {results.map((result, index) => (
              <li
                key={`${result.type}-${result.id}`}
                id={`result-${index}`}
                ref={el => resultsRef.current[index] = el}
                className={`search-result-item ${selectedIndex === index ? 'selected' : ''}`}
                onClick={() => onResultClick?.(result)}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={selectedIndex === index}
                tabIndex={0}
              >
                <div className="result-type">{result.type}</div>
                <div className="result-name">{result.name}</div>
                <div className="result-description">{result.excerpt}</div>
              </li>
            ))}
          </ul>
        )}
</div>
    </div>
  );
};

export default SearchPanel;
