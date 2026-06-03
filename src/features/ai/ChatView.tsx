import React, { useRef, useEffect, useCallback } from 'react';
import { Bot, User, Loader2, Globe, ExternalLink, X, Send } from 'lucide-react';
import { Message, TokenUsage } from './useChat';
import { ResolvedContent } from '../../lib/resolver';
import MarkdownRenderer from '../../lib/llm/markdown';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  isSourcing: boolean;
  resolvedSources: ResolvedContent[];
  sessionTokens: TokenUsage;
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onRemoveSource: (index: number) => void;
  currentModel: string;
  rateLimitLevel: string;
  rateLimitInfo: { count: number; limit: number };
}

const safeHostname = (url: string): string => {
  try { return new URL(url).hostname; } catch { return url; }
};

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  isSourcing,
  resolvedSources,
  sessionTokens,
  input,
  setInput,
  onSend,
  onRemoveSource,
  currentModel,
  rateLimitLevel,
  rateLimitInfo,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, [setInput]);

  return (
    <>
      {isSourcing && (
        <div className="sourcing-indicator">
          <Loader2 className="animate-spin" size={14} />
          <Globe size={14} />
          Sourcing external data...
        </div>
      )}

      {resolvedSources.length > 0 && (
        <div className="source-chips">
          {resolvedSources.map((s, i) => (
            <div key={s.url} className="source-chip" title={s.title || s.url}>
              <ExternalLink size={12} />
              <span className="source-chip-label">{s.title || safeHostname(s.url)}</span>
              <span className="source-chip-provider">{s.provider}</span>
              <button
                type="button"
                className="source-chip-remove"
                onClick={() => { onRemoveSource(i); }}
                aria-label={`Remove source ${s.title || s.url}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="messages-list" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              {m.role === 'assistant' ? 'Assistant' : 'You'}
            </div>
            {m.role === 'assistant' ? (
              <MarkdownRenderer content={m.content} />
            ) : (
              m.content
            )}
            {m.tokenUsage && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {`${m.tokenUsage.input + m.tokenUsage.output} tokens`}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <Loader2 className="animate-spin" size={16} /> Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-controls" style={{ flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI agent..."
            disabled={isLoading}
            aria-label="Ask the AI agent"
          />
          <button type="button" className="primary" onClick={onSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Model: {currentModel ? currentModel.split('/').pop() : 'none'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {sessionTokens.input + sessionTokens.output > 0 && (
              <span>Tokens: {sessionTokens.input + sessionTokens.output}</span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              color: rateLimitLevel === 'high' ? '#dc2626'
                : rateLimitLevel === 'medium' ? '#d97706'
                : rateLimitLevel === 'low' ? '#059669'
                : 'var(--text-muted)',
            }}>
              <span style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                background: rateLimitLevel === 'high' ? '#dc2626'
                  : rateLimitLevel === 'medium' ? '#d97706'
                  : rateLimitLevel === 'low' ? '#059669'
                  : 'transparent',
              }} />
              {rateLimitInfo.count > 0 && `${rateLimitInfo.count}/${rateLimitInfo.limit} req/min`}
            </span>
          </span>
        </div>
      </div>
    </>
  );
};
