import React, { useState, useRef } from 'react';
import { searchKnowledge } from '../../lib/search';
import { type RankedResult } from '../../db/repository';
import { logger } from '../../lib/logger';
import { Search, Send, ChevronDown, ChevronUp, Database, ShieldCheck, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RankedResult[];
}

interface ChatProps {
  onCreateEntity?: () => void;
  onNavigate?: (id: string) => void;
}

function buildResponse(queryText: string, results: RankedResult[]): string {
  if (results.length > 0) {
    return `Based on your local records, here's what I found about "${queryText}". I've cited the most relevant items below.`;
  }
  return `I couldn't find any direct matches in your local library for "${queryText}". You might want to try different keywords or add more context to your entities.`;
}

interface CitationsPanelProps {
  citations: RankedResult[];
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: (id: string) => void;
}

function CitationsPanel({ citations, expanded, onToggle, onNavigate }: CitationsPanelProps): React.ReactElement {
  return (
    <div className="citations-section">
      <button type="button" className="source-drawer-toggle" onClick={onToggle}>
        <span>Used {citations.length} local items</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="citation-cards">
          {citations.map((cite) => (
            <button type="button" key={cite.id} className="citation-card" onClick={() => onNavigate?.(cite.id)}>
              <div className="cite-type">{cite.type}</div>
              <div className="cite-name">{cite.title}</div>
              <div className="cite-excerpt">{cite.content}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  showSources: boolean;
  onToggleSources: () => void;
  onNavigate?: (id: string) => void;
}

function ChatMessage({ message, showSources, onToggleSources, onNavigate }: ChatMessageProps): React.ReactElement {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-header">
        <strong>{message.role === 'user' ? 'You' : 'Studio Assistant'}</strong>
      </div>
      <div className="message-content">
        <div className="msg-text">{message.content}</div>
        {message.citations && message.citations.length > 0 && (
          <CitationsPanel
            citations={message.citations}
            expanded={showSources}
            onToggle={onToggleSources}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

function Chat({ onCreateEntity, onNavigate }: ChatProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function canSend(currentInput: string): boolean {
    return currentInput.trim() !== '' && !isSearching && !debounceRef.current;
  }

  function scheduleDebounceReset() {
    debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 300);
  }

  async function handleSend(e?: React.FormEvent, query?: string) {
    e?.preventDefault();
    const currentInput = query ?? input;
    if (!canSend(currentInput)) return;

    scheduleDebounceReset();
    const userId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userId, role: 'user', content: currentInput }]);
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(currentInput, { limit: 5 });
      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: buildResponse(currentInput, results),
        citations: results
      }]);
    } catch (err) {
      logger.error('Ask retrieval failed', err);
      const errorId = `error-${Date.now()}`;
      setMessages(prev => [...prev, { id: errorId, role: 'assistant', content: 'Sorry, I encountered an issue while searching your local library.' }]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="chat-view">
      <div className="ask-header">
        <div className="local-status-chip">
          <ShieldCheck size={14} />
          <span>Local search only</span>
        </div>
        <div className="offline-badge">Offline ready</div>
      </div>

      <div className="messages-list" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty-state">
            <div className="empty-icon">
              <Database size={48} />
            </div>
            <h2>Ask your library</h2>
            <p>Search and synthesize information across your local entities, claims, and notes. Your data never leaves this device.</p>
            <div className="suggested-actions">
              <button type="button" onClick={() => { void handleSend(undefined, 'Summarize my recent projects'); }}>Summarize recent projects</button>
              <button type="button" onClick={() => { void handleSend(undefined, 'Who are the key people?'); }}>Key people</button>
              <button type="button" onClick={onCreateEntity}>
                Create new entity
              </button>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            showSources={showSources[m.id] ?? false}
            onToggleSources={() => { setShowSources(prev => ({ ...prev, [m.id]: !prev[m.id] })); }}
            onNavigate={onNavigate}
          />
        ))}
        {isSearching && (
          <div className="message assistant loading">
            <div className="searching-indicator">
              <Loader2 size={16} className="animate-spin" />
              <span>Retrieving local context...</span>
            </div>
          </div>
        )}
      </div>

      <form className="chat-controls" onSubmit={(e) => { void handleSend(e); }}>
        <div className="input-wrapper">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your knowledge..."
            disabled={isSearching}
            aria-label="Ask your library"
          />
          <button type="submit" className="send-button" disabled={isSearching || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
