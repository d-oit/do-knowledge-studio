import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Share2,
  MessageSquare,
  Activity,
  Layers,
  Map,
  Plus,
  Download,
  Command,
  X
} from 'lucide-react';
import { searchKnowledge, SearchResult } from '../lib/search';
import { logger } from '../lib/logger';
import { SearchSkeleton } from './Skeletons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai') => void;
  onEntitySelect?: (entityId: string) => void;
  onAction?: (action: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  type: 'navigation' | 'action';
  view?: string;
  shortcut?: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'nav-editor', label: 'Go to Editor', icon: FileText, type: 'navigation', view: 'editor', shortcut: 'G E' },
  { id: 'nav-graph', label: 'Go to Graph', icon: Share2, type: 'navigation', view: 'graph', shortcut: 'G G' },
  { id: 'nav-mindmap', label: 'Go to Mind Map', icon: Map, type: 'navigation', view: 'mindmap', shortcut: 'G M' },
  { id: 'nav-chat', label: 'Go to Chat', icon: MessageSquare, type: 'navigation', view: 'chat', shortcut: 'G C' },
  { id: 'nav-export', label: 'Go to Export', icon: Download, type: 'navigation', view: 'export', shortcut: 'G X' },
  { id: 'nav-ai', label: 'Go to AI Harness', icon: Activity, type: 'navigation', view: 'ai', shortcut: 'G A' },
  { id: 'act-new', label: 'Create New Entity', icon: Plus, type: 'action', shortcut: 'N' },
  { id: 'act-graph-focus', label: 'Toggle Graph Focus', icon: Share2, type: 'action', shortcut: 'F' },
];

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onViewChange, onEntitySelect, onAction }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSearch = () => {
      void (async () => {
        if (query.trim().length < 2) {
          setResults([]);
          setIsSearching(false);
          return;
        }
        setIsSearching(true);
        try {
          const res = await searchKnowledge(query);
          setResults(res);
        } catch (err) {
          logger.error('Palette search failed', err);
        } finally {
          setIsSearching(false);
        }
      })();
    };

    const timer = setTimeout(handleSearch, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredCommands = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = filteredCommands.length + results.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const executeSelected = () => {
    if (selectedIndex < filteredCommands.length) {
      const cmd = filteredCommands[selectedIndex];
      if (cmd.type === 'navigation' && cmd.view) {
        onViewChange(cmd.view);
      } else if (cmd.type === 'action') {
        onAction?.(cmd.id);
      }
    } else {
      // Search result selected — navigate to editor with entity
      const searchIndex: number = selectedIndex - filteredCommands.length;
      const result: SearchResult | undefined = results[searchIndex];
      if (result?.id && onEntitySelect) {
        onEntitySelect(result.id);
      } else {
        onViewChange('editor');
      }
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-overlay"
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="button"
      tabIndex={0}
      aria-label="Close command palette"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => { e.stopPropagation(); }}
        onKeyDown={(e) => { e.stopPropagation(); }}
      >
        <div className="command-palette-header">
          <Search className="search-icon" size={20} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search commands or knowledge..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-label="Search commands and knowledge"
            aria-expanded={totalItems > 0}
            aria-controls="command-palette-listbox"
            aria-activedescendant={totalItems > 0 ? `command-item-${selectedIndex}` : undefined}
          />
          {query && (
            <button
              type="button"
              className="input-clear-button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <div className="esc-hint">ESC</div>
        </div>

        <div className="command-palette-content" id="command-palette-listbox" role="listbox">
          {isSearching && <SearchSkeleton />}
          {!isSearching && filteredCommands.length > 0 && (
            <div className="command-section">
              <div className="section-label">Commands</div>
              {filteredCommands.map((cmd, i) => (
                <div
                  key={cmd.id}
                  id={`command-item-${i}`}
                  className={`command-item ${selectedIndex === i ? 'selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={executeSelected}
                  role="option"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && executeSelected()}
                  aria-selected={selectedIndex === i}
                >
                  <cmd.icon size={18} className="item-icon" />
                  <span className="item-label">{cmd.label}</span>
                  {cmd.shortcut && <span className="item-shortcut">{cmd.shortcut}</span>}
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="command-section">
              <div className="section-label">Knowledge</div>
              {results.map((res, i) => {
                const idx = i + filteredCommands.length;
                return (
                  <div
                    key={res.id}
                    id={`command-item-${idx}`}
                    className={`command-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={executeSelected}
                    role="option"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && executeSelected()}
                    aria-selected={selectedIndex === idx}
                  >
                    <Layers size={18} className="item-icon" />
                    <div className="item-details">
                      <span className="item-label">{res.title}</span>
                      <span className="item-sublabel">{res.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {query && totalItems === 0 && (
            <div className="palette-empty">
              No matches found for &quot;{query}&quot;
            </div>
          )}
        </div>

        <div className="command-palette-footer">
          <div className="footer-tip">
            <kbd><Command size={12} /></kbd> <kbd>K</kbd> to open
          </div>
          <div className="footer-tip">
            <kbd>↑↓</kbd> to navigate
          </div>
          <div className="footer-tip">
            <kbd>↵</kbd> to select
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
