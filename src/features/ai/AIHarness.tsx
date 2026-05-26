import React, { useState, useRef, useEffect } from 'react';
import { loadConfig, saveConfig, createProvider, maskApiKey } from '../../lib/llm/config';
import { searchKnowledge } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';
import { Send, Loader2, Bot, User, Database, Globe, ExternalLink, X, Settings, Key, AlertTriangle } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

/** Extract URLs from a text string. */
const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

/** Safely extract hostname from a URL string, falling back to the raw string. */
const safeHostname = (url: string): string => {
  try { return new URL(url).hostname; } catch { return url; }
};

const AIHarness: React.FC = () => {
  const [config, setConfig] = useState(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [editApiKey, setEditApiKey] = useState('');
  const [editProvider, setEditProvider] = useState(config.activeProvider);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSourcing, setIsSourcing] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [resolvedSources, setResolvedSources] = useState<ResolvedContent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveSettings = () => {
    const updated = { ...config };
    updated.activeProvider = editProvider;
    if (editApiKey) {
      updated.providers[editProvider] = { ...updated.providers[editProvider], apiKey: editApiKey };
    }
    saveConfig(updated);
    setConfig(updated);
    setShowSettings(false);
    setEditApiKey('');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setResolvedSources([]);

    try {
      let contextString = '';
      let externalContent = '';

      // Detect URLs in the user query and fetch external context
      const urls = userMessage.match(URL_REGEX);
      if (urls && urls.length > 0) {
        setIsSourcing(true);
        const uniqueUrls = [...new Set(urls.map(u => u.replace(/[.,;:!?)]+$/, '')))];
        const urlsToFetch = uniqueUrls.slice(0, 3);
        
        const results = await Promise.allSettled(urlsToFetch.map(url => resolveUrl(url)));
        const sources: ResolvedContent[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            sources.push(result.value);
          } else {
            logger.warn('Failed to resolve URL for RAG', { err: result.reason });
          }
        }
        
        setResolvedSources(sources);
        setIsSourcing(false);

        if (sources.length > 0) {
          externalContent = "\n\nExternal source content:\n" + sources.map(s => {
            const header = s.title ? `# ${s.title}` : `Source: ${s.url}`;
            return `${header}\nURL: ${s.url}\nProvider: ${s.provider}\nContent: ${s.content.slice(0, 3000)}`;
          }).join('\n\n---\n\n');
        }
      }

      if (useContext) {
        const results = await searchKnowledge(userMessage);
        if (results.length > 0) {
          contextString = "\n\nRelevant local context:\n" + results.map(r => `[${r.type}] ${r.name}: ${r.excerpt}`).join('\n');
        }
      }

      const config = loadConfig();
      const provider = createProvider(config);
      
      const promptMessages: Message[] = [
        { role: 'system', content: 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible. When external URLs are provided, analyze their content thoroughly and cite specific details. Mark sources clearly in your response.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString + externalContent }
      ];

      // Use streaming for better UX
      const model = config.activeProvider === 'openrouter'
        ? 'google/gemini-2.0-flash-lite-preview-02-05:free'
        : 'meta-llama/llama-3.1-8b-instruct';

      let streamedContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const stream = provider.chatStream({
        model,
        messages: promptMessages,
        temperature: 0.7,
        maxTokens: 1000
      });

      for await (const chunk of stream) {
        if (chunk.done) break;
        const content: string = chunk.content;
        streamedContent += content;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
          return updated;
        });
      }
    } catch (err) {
      logger.error('AI chat failed', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentApiKey = config.providers[config.activeProvider]?.apiKey || '';
  const hasKey = currentApiKey.length > 0;

  return (      <div className="chat-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0 }}>AI Harness</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasKey && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Key size={12} /> {maskApiKey(currentApiKey)}
            </span>
          )}
          <button
            onClick={() => { setShowSettings(!showSettings); setEditApiKey(''); setEditProvider(config.activeProvider); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
            aria-label="API settings"
            title="API settings"
          >
            <Settings size={16} />
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={useContext} onChange={e => setUseContext(e.target.checked)} />
            <Database size={16} /> Augment with Local Knowledge
          </label>
        </div>
      </div>

      {!hasKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '12px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '6px', fontSize: '13px', color: 'var(--warning-text, #92400e)' }}>
          <AlertTriangle size={16} />
          <span>No API key configured. Set one in the settings (<Settings size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />) to enable AI features.</span>
        </div>
      )}

      {showSettings && (
        <div style={{ padding: '12px', marginBottom: '12px', background: 'var(--surface-secondary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="ai-provider" style={{ fontSize: '13px', fontWeight: 600 }}>Provider</label>
            <select
              id="ai-provider"
              value={editProvider}
              onChange={e => setEditProvider(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
            >
              {Object.keys(config.providers).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <label htmlFor="ai-api-key" style={{ fontSize: '13px', fontWeight: 600 }}>API Key</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="ai-api-key"
                type="password"
                value={editApiKey}
                onChange={e => setEditApiKey(e.target.value)}
                placeholder={hasKey ? 'Leave blank to keep current key' : 'Enter API key'}
                style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
              />
              <button className="primary" onClick={handleSaveSettings} disabled={!editApiKey && !hasKey} style={{ padding: '6px 12px' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sourcing indicator */}
      {isSourcing && (
        <div className="sourcing-indicator">
          <Loader2 className="animate-spin" size={14} />
          <Globe size={14} />
          Sourcing external data...
        </div>
      )}

      {/* Resolved source chips */}
      {resolvedSources.length > 0 && (
        <div className="source-chips">
          {resolvedSources.map((s, i) => (
            <div key={i} className="source-chip" title={`${s.title || s.url}\nProvider: ${s.provider}\n${s.wordCount} words`}>
              <ExternalLink size={12} />
              <span className="source-chip-label">{s.title || safeHostname(s.url)}</span>
              <span className="source-chip-provider">{s.provider}</span>
              <button
                className="source-chip-remove"
                onClick={() => setResolvedSources(prev => prev.filter((_, j) => j !== i))}
                aria-label={`Remove source ${s.title || s.url}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="messages-list">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              {m.role === 'assistant' ? 'Assistant' : 'You'}
            </div>
            {m.content}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <Loader2 className="animate-spin" size={16} /> Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-controls">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask the AI agent..." 
          disabled={isLoading}
        />
        <button className="primary" onClick={handleSend} disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
};

export default AIHarness;

