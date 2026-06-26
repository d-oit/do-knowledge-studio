import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchKnowledge } from '../../lib/search';
import { type RankedResult } from '../../db/repository';
import { logger } from '../../lib/logger';
import { loadConfig, createProvider } from '../../lib/llm/config';
import type { LLMMessage } from '../../lib/llm/types';
import { Search, Send, ChevronDown, ChevronUp, Database, ShieldCheck, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { scrollIntoViewSmooth } from '../../lib/motion';

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
      <button type="button" className="source-drawer-toggle" onClick={onToggle} aria-expanded={expanded}>
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

const SYSTEM_PROMPT = 'You are a helpful knowledge assistant for Knowledge Studio. Ground your answers in the provided local context whenever possible. Be concise and cite specific entities or claims when relevant.';

function Chat({ onCreateEntity, onNavigate }: ChatProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});
  const [llmAvailable, setLlmAvailable] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    if (messagesEndRef.current) {
      scrollIntoViewSmooth(messagesEndRef.current);
    }
  }, [messages]);

  useEffect(() => {
    if (isSearching && messagesEndRef.current) {
      scrollIntoViewSmooth(messagesEndRef.current);
    }
  }, [isSearching]);

  useEffect(() => {
    void (async () => {
      try {
        const config = await loadConfig();
        const provider = createProvider(config);
        setLlmAvailable(provider.isConfigured());
      } catch {
        setLlmAvailable(false);
      }
    })();
  }, []);

  const handleSend = useCallback(async (e?: React.FormEvent, query?: string) => {
    e?.preventDefault();
    const currentInput = query ?? input;
    if (currentInput.trim() === '' || isSearching || debounceRef.current) return;

    debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 300);
    const userId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userId, role: 'user', content: currentInput }]);
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(currentInput, { limit: 5 });

      if (llmAvailable) {
        const config = await loadConfig();
        const provider = createProvider(config);
        const providerConfig = config.providers[config.activeProvider];
        const model = providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

        const contextBlock = results.length > 0
          ? '\n\nRelevant local context:\n' + results.map(r => `[${r.type}] ${r.title}: ${r.content.slice(0, 200)}`).join('\n')
          : '';

        const historyMessages: LLMMessage[] = messagesRef.current.slice(-6).map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        }));

        const promptMessages: LLMMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...historyMessages,
          { role: 'user', content: currentInput + contextBlock },
        ];

        const assistantId = `assistant-${Date.now()}`;
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

        const stream = provider.chatStream({ model, messages: promptMessages, temperature: 0.3 });
        let accumulated = '';

        for await (const chunk of stream) {
          if (chunk.content) {
            accumulated += chunk.content;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: accumulated, citations: results } : m
            ));
          }
        }
      } else {
        const assistantId = `assistant-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: buildResponse(currentInput, results),
          citations: results
        }]);
      }
    } catch (err) {
      logger.error('Chat failed', err);
      const errorId = `error-${Date.now()}`;
      setMessages(prev => [...prev, { id: errorId, role: 'assistant', content: 'Sorry, I encountered an issue while processing your request.' }]);
    } finally {
      setIsSearching(false);
    }
  }, [input, llmAvailable, isSearching]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setShowSources({});
  }, []);

  return (
    <div className="chat-view">
      <div className="ask-header">
        <div className="local-status-chip">
          {llmAvailable ? <Sparkles size={14} /> : <ShieldCheck size={14} />}
          <span>{llmAvailable ? 'LLM powered' : 'Local search only'}</span>
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
              <span>{llmAvailable ? 'Thinking...' : 'Retrieving local context...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
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
          <button type="submit" className="send-button" disabled={isSearching || !input.trim()} aria-label="Send message" title="Send message">
            <Send size={18} />
          </button>
        </div>
        <div className="chat-footer">
          <div className="chat-footer-left">
            <span>{llmAvailable ? 'Secure LLM session' : 'Local search active'}</span>
          </div>
          <div className="chat-footer-right">
            <button
              type="button"
              className="chat-clear-btn"
              onClick={handleClearChat}
              title="Clear chat"
              aria-label="Clear chat history"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Chat;
