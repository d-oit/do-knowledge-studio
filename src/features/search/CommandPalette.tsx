import React, { useState, useEffect, useRef } from 'react';
import { Command, Navigation, Zap } from 'lucide-react';
import { searchKnowledge, SearchResult } from '../../lib/search';
import { logger } from '../../lib/logger';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onResultClick: (result: SearchResult) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigationActions = [
    { id: 'nav-editor', title: 'Go to Editor', icon: <Navigation size={16} />, action: () => onNavigate('editor') },
    { id: 'nav-graph', title: 'Go to Graph', icon: <Navigation size={16} />, action: () => onNavigate('graph') },
    { id: 'nav-mindmap', title: 'Go to Mind Map', icon: <Navigation size={16} />, action: () => onNavigate('mindmap') },
    { id: 'nav-chat', title: 'Go to AI Chat', icon: <Navigation size={16} />, action: () => onNavigate('chat') },
  ];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        try {
          const res = await searchKnowledge(query);
          setResults(res.slice(0, 5));
          setSelectedIndex(0);
        } catch (err) {
          logger.error('Command Palette search failed', err);
        }
      } else {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = navigationActions.length + results.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < navigationActions.length) {
        navigationActions[selectedIndex].action();
      } else {
        onResultClick(results[selectedIndex - navigationActions.length]);
      }
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-wrapper">
          <Command size={20} className="command-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="command-shortcut">ESC</div>
        </div>

        <div className="command-results">
          {query.trim().length <= 1 && (
            <div className="command-section">
              <div className="section-label">Navigation</div>
              {navigationActions.map((action, index) => (
                <div
                  key={action.id}
                  className={`command-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => { action.action(); onClose(); }}
                >
                  {action.icon}
                  <span>{action.title}</span>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="command-section">
              <div className="section-label">Knowledge Search</div>
              {results.map((result, index) => {
                const globalIndex = query.trim().length <= 1 ? navigationActions.length + index : index;
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    className={`command-item ${selectedIndex === globalIndex ? 'selected' : ''}`}
                    onClick={() => { onResultClick(result); onClose(); }}
                  >
                    <Zap size={16} />
                    <div className="result-info">
                      <span className="result-title">{result.title}</span>
                      <span className="result-type-tag">{result.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {query.trim().length > 1 && results.length === 0 && (
            <div className="no-results">No matches found for "{query}"</div>
          )}
        </div>

        <div className="command-footer">
          <span><kbd>↑↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
