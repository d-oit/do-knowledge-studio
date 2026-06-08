import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Bot, User, Loader2, Globe, ExternalLink, X, Send, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { Message, TokenUsage, ToolCallRecord } from './useChat';
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

const nameStyle: React.CSSProperties = { fontWeight: 600 };
const labelStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--text-muted)' };
const codeStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
const bodyDivStyle: React.CSSProperties = { padding: '6px 8px', background: 'var(--surface-primary)', display: 'flex', flexDirection: 'column', gap: '4px' };
const blockStyle: React.CSSProperties = { margin: '4px 0', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '12px', overflow: 'hidden' };

const ToolCallHeader: React.FC<{ toolCall: ToolCallRecord; expanded: boolean; onToggle: () => void }> = ({ toolCall, expanded, onToggle }) => {
  const btnStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--surface-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left' };
  const errorStyle: React.CSSProperties = { color: '#dc2626', marginLeft: 'auto' };
  const iconStyle: React.CSSProperties = { marginLeft: toolCall.isError ? '0' : 'auto' };
  return (
    <button type="button" onClick={onToggle} style={btnStyle} aria-expanded={expanded}>
      <Wrench size={12} />
      <span style={nameStyle}>{toolCall.name}</span>
      {toolCall.isError && <span style={errorStyle}>error</span>}
      <span style={iconStyle}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </span>
    </button>
  );
};

const ToolCallBody: React.FC<{ toolCall: ToolCallRecord }> = ({ toolCall }) => {
  const resultCodeStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: toolCall.isError ? '#dc2626' : undefined };
  return (
    <div style={bodyDivStyle}>
      <div>
        <span style={labelStyle}>Input: </span>
        <code style={codeStyle}>{JSON.stringify(toolCall.arguments, null, 2)}</code>
      </div>
      {toolCall.result !== undefined && (
        <div>
          <span style={labelStyle}>Result: </span>
          <code style={resultCodeStyle}>{toolCall.result}</code>
        </div>
      )}
    </div>
  );
};

const ToolCallBlock: React.FC<{ toolCall: ToolCallRecord }> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => { setExpanded(v => !v); }, []);
  return (
    <div style={blockStyle}>
      <ToolCallHeader toolCall={toolCall} expanded={expanded} onToggle={toggle} />
      {expanded && <ToolCallBody toolCall={toolCall} />}
    </div>
  );
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
                aria-label={"Remove source " + (s.title || s.url)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="messages-list" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={"message " + m.role}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              {m.role === 'assistant' ? 'Assistant' : 'You'}
            </div>
            {m.role === 'assistant' ? (
              <>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    {m.toolCalls.map(tc => <ToolCallBlock key={tc.id} toolCall={tc} />)}
                  </div>
                )}
                <MarkdownRenderer content={m.content} />
              </>
            ) : (
              m.content
            )}
            {m.tokenUsage && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {(m.tokenUsage.input + m.tokenUsage.output) + " tokens"}
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
              {rateLimitInfo.count > 0 && (rateLimitInfo.count + "/" + rateLimitInfo.limit + " req/min")}
            </span>
          </span>
        </div>
      </div>
    </>
  );
};
