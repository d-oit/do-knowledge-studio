import React, { useState, useRef } from 'react';
import { searchKnowledge } from '../../lib/search';
import { type RankedResult } from '../../db/repository';
import { logger } from '../../lib/logger';
import { Search, Send, ChevronDown, ChevronUp, Database, ShieldCheck, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: RankedResult[];
}

interface ChatProps {
  onCreateEntity?: () => void;
  onNavigate?: (id: string) => void;
}

const buildResponse = (input: string, results: RankedResult[]): string => {
  if (results.length > 0) {
    return `Based on your local records, here's what I found about "${input}". I've cited the most relevant items below.`;
  }
  return `I couldn't find any direct matches in your local library for "${input}". You might want to try different keywords or add more context to your entities.`;
};

const Chat: React.FC<ChatProps> = ({ onCreateEntity, onNavigate }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = async (e?: React.FormEvent, query?: string) => {
    e?.preventDefault();
    const currentInput = query ?? input;
    if (!currentInput.trim() || isSearching || debounceRef.current) return;

    debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 300);
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(currentInput, { limit: 5 });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: buildResponse(currentInput, results),
        citations: results
      }]);
    } catch (err) {
      logger.error('Ask retrieval failed', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue while searching your local library.' }]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSources = (index: number) => {
    setShowSources(prev => ({ ...prev, [index]: !prev[index] }));
  };

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
              <button onClick={() => { handleSend(undefined, 'Summarize my recent projects').catch(console.error); }}>Summarize recent projects</button>
              <button onClick={() => { handleSend(undefined, 'Who are the key people?').catch(console.error); }}>Key people</button>
              <button onClick={onCreateEntity}>
                Create new entity
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="message-header">
              <strong>{m.role === 'user' ? 'You' : 'Studio Assistant'}</strong>
            </div>
            <div className="message-content">
              <div className="msg-text">{m.content}</div>

              {m.citations && m.citations.length > 0 && (
                <div className="citations-section">
                  <button
                    className="source-drawer-toggle"
                    onClick={() => toggleSources(i)}
                  >
                    <span>Used {m.citations.length} local items</span>
                    {showSources[i] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showSources[i] && (
                    <div className="citation-cards">
                      {m.citations.map((cite) => (
                        <button key={cite.id} className="citation-card" onClick={() => onNavigate?.(cite.id)}>
                          <div className="cite-type">{cite.type}</div>
                          <div className="cite-name">{cite.title}</div>
                          <div className="cite-excerpt">{cite.content}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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

      <form className="chat-controls" onSubmit={e => { handleSend(e).catch(console.error); }}>
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
