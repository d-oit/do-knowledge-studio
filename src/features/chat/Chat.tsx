import React, { useState } from 'react';
import { searchKnowledge, RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search, Send, ChevronDown, ChevronUp, Database, ShieldCheck } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: RankedResult[];
}

const Chat: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSearching) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(currentInput);

      let response = '';
      if (results.length > 0) {
        response = `Based on your local records, here's what I found about "${currentInput}". I've cited the most relevant items below.`;
      } else {
        response = `I couldn't find any direct matches in your local library for "${currentInput}". You might want to try different keywords or add more context to your entities.`;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
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
    <div className="ask-surface">
      <div className="ask-header">
        <div className="local-status-chip">
          <ShieldCheck size={14} />
          <span>Local search only</span>
        </div>
        <div className="offline-badge">Offline ready</div>
      </div>

      <div className="messages-list">
        {messages.length === 0 && (
          <div className="ask-empty-state">
            <div className="empty-icon">
              <Database size={48} />
            </div>
            <h2>Ask your library</h2>
            <p>Search and synthesize information across your local entities, claims, and notes. Your data never leaves this device.</p>
            <div className="suggested-actions">
              <button onClick={() => setInput('Summarize my recent projects')}>Summarize recent projects</button>
              <button onClick={() => setInput('Who are the key people?')}>Key people</button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message-wrapper ${m.role}`}>
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
                        <button key={cite.id} className="citation-card" onClick={() => logger.info('Navigate to', cite.id)}>
                          <div className="cite-type">{cite.type}</div>
                          <div className="cite-name">{cite.name}</div>
                          <div className="cite-excerpt">{cite.excerpt}</div>
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
          <div className="message-wrapper assistant loading">
            <div className="searching-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span>Retrieving local context...</span>
            </div>
          </div>
        )}
      </div>

      <form className="ask-composer" onSubmit={handleSend}>
        <div className="input-container">
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
