import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchKnowledge } from '../../lib/search';
import { type RankedResult } from '../../db/repository';
import { logger } from '../../lib/logger';
import { loadConfig, createProvider } from '../../lib/llm/config';
import MarkdownRenderer from '../../lib/llm/markdown';
import {
  Search,
  Send,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  Trash2,
  Settings,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: RankedResult[];
  tokenUsage?: { input: number; output: number };
}

interface ChatProps {
  onCreateEntity?: () => void;
  onOpenSettings?: () => void;
}

const HISTORY_KEY = 'dks:chat-history';

const Chat: React.FC<ChatProps> = ({ onCreateEntity, onOpenSettings }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) as Message[] : [];
    } catch {
      return [];
    }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});
  const [config, setConfig] = useState(() => loadConfig());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearHistory = useCallback(() => {
    if (confirm('Clear chat history?')) {
      setMessages([]);
      localStorage.removeItem(HISTORY_KEY);
    }
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSearching || isStreaming) return;
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 300);

    const userMessage = input.trim();
    const userMsg: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(userMessage, { limit: 5 });
      setIsSearching(false);
      setIsStreaming(true);

      const contextString = results.length > 0
        ? "\n\nRelevant local context:\n" + results.map(r => `[${r.type}] ${r.title}: ${r.content}`).join('\n')
        : "";

      const currentConfig = loadConfig();
      const provider = createProvider(currentConfig);
      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      const promptMessages: Message[] = [
        { role: 'system', content: 'You are a helpful knowledge assistant. Ground your answers in the provided local context whenever possible. If you find relevant information, cite it clearly. If the user asks about something not in your context, answer based on your general knowledge but mention it was not found in the local library.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString }
      ];

      let streamedContent = '';
      let streamUsage: { input: number; output: number } | undefined;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        citations: results
      }]);

      const stream = provider.chatStream({
        model,
        messages: promptMessages,
        temperature: 0.7,
        maxTokens: 1000
      });

      for await (const chunk of stream) {
        if (chunk.done) {
          if (chunk.usage) {
            streamUsage = { input: chunk.usage.inputTokens, output: chunk.usage.outputTokens };
          }
          break;
        }
        streamedContent += chunk.content;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: streamedContent };
          }
          return updated;
        });
      }

      if (streamUsage) {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, tokenUsage: streamUsage };
          }
          return updated;
        });
      }
    } catch (err) {
      logger.error('Ask synthesis failed', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: 'Sorry, I encountered an issue while generating a response. Please check your AI configuration.' };
          return updated;
        }
        return [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue while generating a response. Please check your AI configuration.' }];
      });
    } finally {
      setIsSearching(false);
      setIsStreaming(false);
    }
  };

  const toggleSources = (index: number) => {
    setShowSources(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const currentApiKey = config.providers[config.activeProvider].apiKey || '';
  const hasKey = currentApiKey.length > 0;

  return (
    <div className="ask-surface chat-view">
      <div className="ask-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="local-status-chip">
            <ShieldCheck size={14} />
            <span>Local context</span>
          </div>
          {hasKey ? (
            <div className="local-status-chip" style={{ background: 'var(--bg-active)', color: 'var(--interactive-primary)' }}>
              <Database size={14} />
              <span>AI Powered</span>
            </div>
          ) : (
            <div className="local-status-chip" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <AlertTriangle size={14} />
              <span>AI Not Configured</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {messages.length > 0 && (
            <button className="icon-button" onClick={handleClearHistory} title="Clear conversation" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button className="icon-button" onClick={onOpenSettings} title="AI Settings" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Settings size={16} />
          </button>
        </div>
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
              <button onClick={onCreateEntity}>
                Create new entity
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message-wrapper ${m.role} message ${m.role}`}>
            <div className="message-header">
              <strong>{m.role === 'user' ? 'You' : 'Studio Assistant'}</strong>
              {m.tokenUsage && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({m.tokenUsage.input + m.tokenUsage.output} tokens)
                </span>
              )}
            </div>
            <div className="message-content">
              <div className="msg-text">
                {m.role === 'assistant' ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  m.content
                )}
              </div>

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
        {(isSearching || isStreaming) && (
          <div className="message-wrapper assistant loading">
            <div className="searching-indicator">
              <Loader2 size={16} className="animate-spin" />
              <span>{isSearching ? 'Retrieving local context...' : 'Synthesizing response...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!hasKey && (
        <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--warning-text)', background: 'var(--warning-bg)', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={14} />
          <span>AI provider not configured. Please add an API key in the AI Harness settings.</span>
        </div>
      )}

      <form className="ask-composer" onSubmit={e => void handleSend(e)}>
        <div className="input-container chat-controls">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your knowledge..."
            disabled={isSearching || isStreaming}
            aria-label="Ask your library"
          />
          <button type="submit" className="send-button primary" disabled={isSearching || isStreaming || !input.trim()}>
            {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
