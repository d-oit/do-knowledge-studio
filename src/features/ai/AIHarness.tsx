import React, { useState, useRef, useEffect, useCallback } from 'react';
import { loadConfig, saveConfig, createProvider, maskApiKey } from '../../lib/llm/config';
import { saveDbHandles, getDbHandles } from '../../lib/db-persistence';
import { PROVIDER_MODELS } from '../../lib/llm';
import { searchKnowledge } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';
import MarkdownRenderer from '../../lib/llm/markdown';
import DatabaseSettings from '../../components/DatabaseSettings';
import { Send, Loader2, Bot, User, Database, Globe, ExternalLink, X, Settings, Key, AlertTriangle, ChevronRight, Check } from 'lucide-react';

const WIZARD_SEEN_KEY = 'dks:ai-wizard-seen';
const PROVIDER_MODELS_MAP = new Map(Object.entries(PROVIDER_MODELS));

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
  tokenUsage?: { input: number; output: number };
}

interface TokenUsage {
  input: number;
  output: number;
}

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

const safeHostname = (url: string): string => {
  try { return new URL(url).hostname; } catch { return url; }
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_THRESHOLD = 15;

const AIHarness: React.FC = () => {
  const [config, setConfig] = useState(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [editApiKey, setEditApiKey] = useState('');
  const [editProvider, setEditProvider] = useState(config.activeProvider);
  const [editModel, setEditModel] = useState(
    config.providers[config.activeProvider].defaultModel || ''
  );
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSourcing, setIsSourcing] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [resolvedSources, setResolvedSources] = useState<ResolvedContent[]>([]);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ input: 0, output: 0 });
  const [dbHandle, setDbHandle] = useState<FileSystemFileHandle | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardApiKey, setWizardApiKey] = useState('');
  const [wizardProvider, setWizardProvider] = useState(config.activeProvider);
  const [wizardModel, setWizardModel] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestTimestamps = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wizardApiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(WIZARD_SEEN_KEY);
    const hasAnyKey = Object.values(config.providers).some(p => p.apiKey);
    if (!seen && !hasAnyKey) {
      setShowWizard(true);
    }
    void getDbHandles().then(({ fileHandle }) => {
      if (fileHandle) setDbHandle(fileHandle);
    });
  }, [config.providers]);

  useEffect(() => {
    if (wizardStep === 2 && wizardApiKeyRef.current) wizardApiKeyRef.current.focus();
  }, [wizardStep]);

  useEffect(() => {
    if (!showSettings && editModel && editProvider === config.activeProvider) {
      const providerModels = PROVIDER_MODELS[config.activeProvider];
      const currentModel = Object.values(providerModels).includes(editModel)
        ? editModel
        : (config.providers[config.activeProvider].defaultModel || '');
      if (currentModel && currentModel !== editModel) {
        setEditModel(currentModel);
      }
    }
  }, [showSettings, editModel, config.activeProvider, config.providers, editProvider]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const trackRequest = useCallback(() => {
    const now = Date.now();
    requestTimestamps.current = requestTimestamps.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    requestTimestamps.current.push(now);
  }, []);

  const getRateLimitInfo = useCallback(() => {
    const now = Date.now();
    const recent = requestTimestamps.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    return { count: recent.length, limit: RATE_LIMIT_THRESHOLD };
  }, []);

  const getRateLimitLevel = useCallback(() => {
    const { count, limit } = getRateLimitInfo();
    if (count === 0) return 'none';
    const ratio = count / limit;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  }, [getRateLimitInfo]);

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
    setEditApiKey('');
    setEditProvider(config.activeProvider);
    const providerConfig = config.providers[config.activeProvider];
    setEditModel(providerConfig.defaultModel || '');
  }, [config.activeProvider, config.providers]);

  const handleSaveSettings = useCallback(() => {
    const entries = Object.entries(config.providers);
    const entry = entries.find(([key]) => key === editProvider);
    if (!entry) return;
    const [, providerConfig] = entry;
    const updatedProvider = { ...providerConfig };
    if (editApiKey) updatedProvider.apiKey = editApiKey;
    if (editModel) updatedProvider.defaultModel = editModel;
    const updated = {
      ...config,
      activeProvider: editProvider,
      providers: Object.fromEntries(
        entries.map(([key, val]) => [key, key === editProvider ? updatedProvider : val])
      ),
    };
    saveConfig(updated);
    setConfig(updated);
    setShowSettings(false);
    setEditApiKey('');
  }, [config, editProvider, editApiKey, editModel]);

  const handleWizardNext = useCallback(() => {
    if (wizardStep < 2) {
      setWizardStep(wizardStep + 1);
    }
  }, [wizardStep]);

  const handleWizardBack = useCallback(() => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  }, [wizardStep]);

  const handleWizardComplete = useCallback(() => {
    const entries = Object.entries(config.providers);
    const entry = entries.find(([key]) => key === wizardProvider);
    if (!entry) return;
    const [, providerConfig] = entry;
    const updatedProvider = { ...providerConfig };
    if (wizardApiKey) updatedProvider.apiKey = wizardApiKey;
    if (wizardModel) updatedProvider.defaultModel = wizardModel;
    const updated = {
      ...config,
      activeProvider: wizardProvider,
      providers: Object.fromEntries(
        entries.map(([key, val]) => [key, key === wizardProvider ? updatedProvider : val])
      ),
    };
    saveConfig(updated);
    setConfig(updated);
    localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    setShowWizard(false);
    setWizardStep(0);
    setWizardApiKey('');
  }, [config, wizardProvider, wizardApiKey, wizardModel]);

  const handleSkipWizard = useCallback(() => {
    localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    setShowWizard(false);
    setWizardStep(0);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    trackRequest();
    setResolvedSources([]);

    try {
      let contextString = '';
      let externalContent = '';

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
            logger.warn('Failed to resolve URL for RAG', { err: String(result.reason) });
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

      const currentConfig = loadConfig();
      const provider = createProvider(currentConfig);

      const promptMessages: Message[] = [
        { role: 'system', content: 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible. When external URLs are provided, analyze their content thoroughly and cite specific details. Mark sources clearly in your response.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString + externalContent }
      ];

      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = providerConfig.defaultModel || editModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      let streamedContent = '';
      let streamUsage: { input: number; output: number } | undefined;
      setMessages(prev => [...prev, { role: 'assistant', content: '', tokenUsage: undefined }]);

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
            setSessionTokens(prev => ({
              input: prev.input + chunk.usage.inputTokens,
              output: prev.output + chunk.usage.outputTokens,
            }));
          }
          break;
        }
        const content: string = chunk.content;
        streamedContent += content;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
          return updated;
        });
      }

      if (streamUsage) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent, tokenUsage: streamUsage };
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
  }, [input, isLoading, useContext, messages, editModel, trackRequest]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const currentApiKey = config.providers[config.activeProvider].apiKey || '';
  const hasKey = currentApiKey.length > 0;

  const availableModels = PROVIDER_MODELS_MAP.get(editProvider) || {};
  const currentModel = config.providers[config.activeProvider].defaultModel || '';
  const providerModelEntries = Object.entries(availableModels);

  const handleDbHandlesSelected = useCallback(async (fileHandle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle) => {
    await saveDbHandles(fileHandle, dirHandle);
    setDbHandle(fileHandle);
    // Notify user that reload is needed to switch database
    if (confirm('Database connection updated. Reload now to apply changes?')) {
      window.location.reload();
    }
  }, []);

  const wizardModelEntries = Object.entries(PROVIDER_MODELS_MAP.get(wizardProvider) || {});
  const rateLimitLevel = getRateLimitLevel();

  return (
    <div className="chat-view">
      {showWizard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--surface-primary, #fff)',
            borderRadius: '12px', padding: '32px',
            maxWidth: '480px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {wizardStep === 0 && (
              <>
                <div style={{ fontSize: '28px', marginBottom: '16px' }}>🤖</div>
                <h2 style={{ margin: '0 0 8px' }}>Welcome to AI Harness</h2>
                <p style={{ color: 'var(--text-secondary, #666)', margin: '0 0 24px', lineHeight: 1.5 }}>
                  This assistant can answer questions, analyze URLs, and search your local knowledge base.
                  Let&rsquo;s get you set up with an AI provider.
                </p>
                <button type="button" className="primary" onClick={handleWizardNext} style={{ width: '100%', padding: '10px' }}>
                  Get Started <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
                </button>
              </>
            )}

            {wizardStep === 1 && (
              <>
                <h3 style={{ margin: '0 0 16px' }}>Choose Provider &amp; Model</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label htmlFor="wizard-provider" style={{ fontSize: '13px', fontWeight: 600 }}>Provider</label>
                  <select
                    id="wizard-provider"
                    value={wizardProvider}
                    onChange={e => {
                      setWizardProvider(e.target.value);
                      const models = PROVIDER_MODELS[e.target.value];
                      const firstModel = Object.values(models)[0] || '';
                      setWizardModel(firstModel);
                    }}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-default, #ddd)' }}
                  >
                    {Object.keys(config.providers).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <label htmlFor="wizard-model" style={{ fontSize: '13px', fontWeight: 600 }}>Model</label>
                  <select
                    id="wizard-model"
                    value={wizardModel}
                    onChange={e => { setWizardModel(e.target.value); }}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-default, #ddd)' }}
                  >
                    {wizardModelEntries.map(([label, value]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                  <button type="button" onClick={handleWizardBack} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-default, #ddd)', borderRadius: '6px', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button type="button" className="primary" onClick={handleWizardNext} style={{ flex: 1, padding: '10px' }}>
                    Next <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
                  </button>
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <h3 style={{ margin: '0 0 16px' }}>Enter API Key</h3>
                <p style={{ color: 'var(--text-secondary, #666)', margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
                  Your API key stays local in your browser. Never shared with anyone.
                </p>
                <input
                  ref={wizardApiKeyRef}
                  type="password"
                  value={wizardApiKey}
                  onChange={e => { setWizardApiKey(e.target.value); }}
                  placeholder={`Enter ${wizardProvider} API key`}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-default, #ddd)', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                  <button type="button" onClick={handleWizardBack} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-default, #ddd)', borderRadius: '6px', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button type="button" className="primary" onClick={handleWizardComplete} disabled={!wizardApiKey} style={{ flex: 1, padding: '10px' }}>
                    <Check size={16} style={{ verticalAlign: 'middle' }} /> Complete Setup
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleSkipWizard}
              style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--text-muted, #999)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Skip setup
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0 }}>AI Harness</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasKey && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Key size={12} /> {maskApiKey(currentApiKey)}
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleSettings}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
            aria-label="API settings"
            title="API settings"
          >
            <Settings size={16} />
          </button>
          <label htmlFor="use-context-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
            <input id="use-context-checkbox" type="checkbox" checked={useContext} onChange={e => { setUseContext(e.target.checked); }} />
            <Database size={16} /> Augment with Local Knowledge
          </label>
        </div>
      </div>

      {!hasKey && !showWizard && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '12px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '6px', fontSize: '13px', color: 'var(--warning-text, #92400e)' }}>
          <AlertTriangle size={16} />
          <span>No API key configured. Set one in the settings (<Settings size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />) to enable AI features.</span>
        </div>
      )}

      {showSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          <DatabaseSettings onHandlesSelected={(...args) => void handleDbHandlesSelected(...args)} currentHandle={dbHandle} />

          <div style={{ padding: '12px', background: 'var(--surface-secondary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="ai-provider" style={{ fontSize: '13px', fontWeight: 600 }}>Provider</label>
            <select
              id="ai-provider"
              value={editProvider}
              onChange={e => {
                setEditProvider(e.target.value);
                const models = PROVIDER_MODELS[e.target.value];
                const firstModel = (Object.values(models)[0] as string | undefined) || '';
                setEditModel(firstModel);
              }}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
            >
              {Object.keys(config.providers).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <label htmlFor="ai-model" style={{ fontSize: '13px', fontWeight: 600 }}>Model</label>
            <select
              id="ai-model"
              value={editModel}
              onChange={e => { setEditModel(e.target.value); }}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
            >
              {providerModelEntries.map(([label, value]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <label htmlFor="ai-api-key" style={{ fontSize: '13px', fontWeight: 600 }}>API Key</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="ai-api-key"
                type="password"
                value={editApiKey}
                onChange={e => { setEditApiKey(e.target.value); }}
                placeholder={hasKey ? 'Leave blank to keep current key' : 'Enter API key'}
                style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
              />
              <button type="button" className="primary" onClick={handleSaveSettings} style={{ padding: '6px 12px' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

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
            <div key={i} className="source-chip" title={`${s.title || s.url}\nProvider: ${s.provider}\n${s.wordCount} words`}>
              <ExternalLink size={12} />
              <span className="source-chip-label">{s.title || safeHostname(s.url)}</span>
              <span className="source-chip-provider">{s.provider}</span>
              <button
                type="button"
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

      <div className="messages-list" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
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
                {m.tokenUsage.input + m.tokenUsage.output} tokens
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI agent..."
            disabled={isLoading}
            aria-label="Ask the AI agent"
          />
          <button type="button" className="primary" onClick={() => void handleSend()} disabled={isLoading || !input.trim()}>
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
              {getRateLimitInfo().count > 0 && `${getRateLimitInfo().count}/${getRateLimitInfo().limit} req/min`}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIHarness;
