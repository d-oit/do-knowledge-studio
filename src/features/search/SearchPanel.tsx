import React, { useState, useEffect } from 'react';
import { searchKnowledge, type RankedResult, type SearchStage } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, X, Network, Zap } from 'lucide-react';

interface SearchPanelProps {
  onClose?: () => void;
  isMobile?: boolean;
  onResultClick?: (result: RankedResult) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onClose, isMobile, onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [includeGraph, setIncludeGraph] = useState(false);

  const performSearch = async (currentQuery: string, useGraph: boolean) => {
    if (currentQuery.trim().length > 1) {
      setIsSearching(true);
      try {
        const stages: SearchStage[] = ['fts5', 'semantic'];
        if (useGraph) stages.push('graph');

        const res = await searchKnowledge(currentQuery, { stages });
        setResults(res);
      } catch (err) {
        logger.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setResults([]);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      performSearch(query, includeGraph);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, includeGraph]);

  return (
    <div className={`search-panel ${isMobile ? 'mobile-modal' : 'sidebar-panel'}`}>
      <div className="search-header">
        <div className="input-wrapper">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
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

      <div className="search-options">
        <button
          className={`option-toggle ${includeGraph ? 'active' : ''}`}
          onClick={() => setIncludeGraph(!includeGraph)}
          title="Include related notes from knowledge graph"
        >
          <Network size={14} />
          <span>Related context</span>
        </button>
      </div>

      <div className="search-results">
        {isSearching && <div className="searching-status">Searching...</div>}
        {!isSearching && query.length > 1 && results.length === 0 && (
          <div className="no-results">No matches found for "{query}"</div>
        )}
        {results.map((result) => (
          <div
            key={`${result.stage}-${result.id}`}
            className={`search-result-item stage-${result.stage}`}
            onClick={() => onResultClick && onResultClick(result)}
            role="button"
            tabIndex={0}
          >
            <div className="result-header">
              <span className="result-type">{result.type}</span>
              <span className="result-stage" title={result.reason}>
                {result.stage === 'fts5' && <Zap size={10} />}
                {result.stage === 'graph' && <Network size={10} />}
                {result.stage}
              </span>
            </div>
            <div className="result-name">{result.name}</div>
            <div className="result-description">{result.excerpt}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPanel;
