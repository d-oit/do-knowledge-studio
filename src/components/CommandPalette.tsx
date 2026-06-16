import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  X,
  AlertCircle
} from 'lucide-react';
import { searchKnowledge, SearchResult } from '../lib/search';
import { logger } from '../lib/logger';
import { SearchSkeleton } from './Skeletons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai') => void;
  onAction?: (action: string) => void;
  onResultClick?: (result: SearchResult) => void;
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

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onViewChange,
  onAction,
  onResultClick
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus the input when the palette mounts. The host uses a `key`
  // tied to `isOpen`, so every open creates a fresh instance — no reset
  // effects required.
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    }
  }, [isOpen]);

  // Debounced search. We deliberately avoid calling setState
  // synchronously in the effect body — instead, state updates are
  // performed inside the debounced callback or via the search handler.
  // The render hides stale results when the query is too short.
  useEffect(() => {
    if (!isOpen) return;
    if (query.trim().length < 2) {
      // Schedule the reset asynchronously so the effect body stays
      // side-effect-free from React's perspective.
      queueMicrotask(() => {
        setIsSearching(false);
        setSearchError(null);
      });
      return;
    }
    queueMicrotask(() => setIsSearching(true));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchKnowledge(query);
          if (controller.signal.aborted) return;
          setResults(res);
          setSearchError(null);
        } catch (err) {
          if (controller.signal.aborted) return;
          logger.error('Palette search failed', err);
          setResults([]);
          setSearchError(err instanceof Error ? err.message : 'Search failed');
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const filteredCommands = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = filteredCommands.length + results.length;

  const safeSetIndex = useCallback(
    (next: number) => {
      if (totalItems === 0) {
        setSelectedIndex(0);
        return;
      }
      // Clamp explicitly to avoid the NaN-from-0%0 trap.
      const clamped = ((next % totalItems) + totalItems) % totalItems;
      setSelectedIndex(clamped);
    },
    [totalItems]
  );

  const scrollSelectedIntoView = useCallback((idx: number) => {
    const list = listRef.current;
    if (!list) return;
    const node = list.querySelector<HTMLElement>(`#command-item-${idx}`);
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalItems === 0) return;
      safeSetIndex(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalItems === 0) return;
      safeSetIndex(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Home') {
      e.preventDefault();
      safeSetIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      safeSetIndex(totalItems - 1);
    }
  };

  const executeSelected = () => {
    if (totalItems === 0) {
      // Nothing to do — leave the palette open so the user can adjust the query.
      return;
    }
    if (selectedIndex < filteredCommands.length) {
      const cmd = filteredCommands[selectedIndex];
      if (cmd.type === 'navigation' && cmd.view) {
        onViewChange(cmd.view);
      } else if (cmd.type === 'action') {
        onAction?.(cmd.id);
      }
    } else {
      const result = results[selectedIndex - filteredCommands.length];
      if (result) {
        // Prefer the rich result handler if the host provided one.
        if (onResultClick) {
          onResultClick(result);
        } else {
          onViewChange('editor');
        }
      }
    }
    onClose();
  };

  // Keep the highlighted item in view when the selection changes.
  useEffect(() => {
    scrollSelectedIntoView(selectedIndex);
  }, [selectedIndex, scrollSelectedIntoView]);

  if (!isOpen) return null;

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="command-palette-overlay"
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="command-palette-header">
          <Search className="search-icon" size={20} aria-hidden="true" />
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
            autoComplete="off"
            spellCheck={false}
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
          <div className="esc-hint" aria-hidden="true">ESC</div>
        </div>

        <div
          className="command-palette-content"
          id="command-palette-listbox"
          role="listbox"
          aria-label="Commands and knowledge"
          ref={listRef}
        >
          {isSearching && <SearchSkeleton />}

          {!isSearching && !searchError && filteredCommands.length > 0 && (
            <div className="command-section">
              <div className="section-label">Commands</div>
              {filteredCommands.map((cmd, i) => (
                <div
                  key={cmd.id}
                  id={`command-item-${i}`}
                  className={`command-item ${selectedIndex === i ? 'selected' : ''}`}
                  onMouseEnter={() => safeSetIndex(i)}
                  onClick={executeSelected}
                  role="option"
                  tabIndex={-1}
                  onKeyDown={e => e.key === 'Enter' && executeSelected()}
                  aria-selected={selectedIndex === i}
                >
                  <cmd.icon size={18} className="item-icon" aria-hidden="true" />
                  <span className="item-label">{cmd.label}</span>
                  {cmd.shortcut && <span className="item-shortcut" aria-hidden="true">{cmd.shortcut}</span>}
                </div>
              ))}
            </div>
          )}

          {!isSearching && !searchError && query.trim().length >= 2 && results.length > 0 && (
            <div className="command-section">
              <div className="section-label">Knowledge</div>
              {results.map((res, i) => {
                const idx = i + filteredCommands.length;
                return (
                  <div
                    key={res.id}
                    id={`command-item-${idx}`}
                    className={`command-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onMouseEnter={() => safeSetIndex(idx)}
                    onClick={executeSelected}
                    role="option"
                    tabIndex={-1}
                    onKeyDown={e => e.key === 'Enter' && executeSelected()}
                    aria-selected={selectedIndex === idx}
                  >
                    <Layers size={18} className="item-icon" aria-hidden="true" />
                    <div className="item-details">
                      <span className="item-label">{res.title}</span>
                      <span className="item-sublabel">{res.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {searchError && (
            <div className="palette-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>Search failed.</strong>
                <p>{searchError}</p>
              </div>
            </div>
          )}

          {!isSearching && !searchError && query && totalItems === 0 && (
            <div className="palette-empty">
              No matches for &quot;{query}&quot;. Try a different search or press <kbd>Esc</kbd> to close.
            </div>
          )}

          {!isSearching && !searchError && !query && (
            <div className="palette-empty palette-hint">
              Type to search commands, or browse the list above.
            </div>
          )}
        </div>

        <div className="command-palette-footer">
          <div className="footer-tip">
            <kbd><Command size={12} /></kbd> <kbd>K</kbd> to open
          </div>
          <div className="footer-tip">
            <kbd>↑</kbd><kbd>↓</kbd> to navigate
          </div>
          <div className="footer-tip">
            <kbd>↵</kbd> to select
          </div>
          <div className="footer-tip">
            <kbd>Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
