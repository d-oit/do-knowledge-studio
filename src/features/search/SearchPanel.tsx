import React, { useState, useEffect } from 'react';
import { searchKnowledge, SearchResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, X } from 'lucide-react';

interface SearchPanelProps {
  onClose?: () => void;
  isMobile?: boolean;
  onResultClick?: (result: SearchResult) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onClose, isMobile, onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setIsSearching(true);
        try {
          const res = await searchKnowledge(query);
          setResults(res);
        } catch (err) {
          logger.error('Search failed', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent, result: SearchResult) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onResultClick?.(result);
    }
  };

  return (
    <div className={`search-panel ${isMobile ? 'mobile-modal' : 'sidebar-panel'}`}>
      <div className="search-header">
        <div className="input-wrapper">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge base..."
            aria-label="Search knowledge base"
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
          <ul className="results-list" aria-label="Search results">
            {results.map((result) => (
              <li
                key={`${result.type}-${result.id}`}
                className="search-result-item"
                onClick={() => onResultClick?.(result)}
                onKeyDown={(e) => handleKeyDown(e, result)}
                role="button"
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
