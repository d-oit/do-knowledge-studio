import React, { useState, useEffect, useCallback } from 'react';
import { loadConfig, saveConfig, maskApiKey } from '../../lib/llm/config';
import { saveDbHandles, getDbHandles } from '../../lib/db-persistence';
import { PROVIDER_MODELS } from '../../lib/llm';
import { logger } from '../../lib/logger';
import DatabaseSettings from '../../components/DatabaseSettings';
import { Database, Settings, Key, AlertTriangle } from 'lucide-react';
import { useChat } from './useChat';
import { useRateLimiter } from './useRateLimiter';
import { ChatView } from './ChatView';
import { SettingsWizard } from './SettingsWizard';

const WIZARD_SEEN_KEY = 'dks:ai-wizard-seen';
const PROVIDER_MODELS_MAP = new Map(Object.entries(PROVIDER_MODELS));

const AIHarness: React.FC = () => {
  const [config, setConfig] = useState(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [editApiKey, setEditApiKey] = useState('');
  const [editProvider, setEditProvider] = useState(config.activeProvider);
  const [editModel, setEditModel] = useState(
    config.providers[config.activeProvider].defaultModel || ''
  );
  const [input, setInput] = useState('');
  const [useContext, setUseContext] = useState(true);
  const [dbHandle, setDbHandle] = useState<FileSystemFileHandle | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const {
    messages,
    isLoading,
    isSourcing,
    resolvedSources,
    sessionTokens,
    sendMessage,
    setResolvedSources,
  } = useChat();

  const {
    trackRequest,
    getRateLimitInfo,
    getRateLimitLevel,
  } = useRateLimiter();

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

  const handleWizardComplete = useCallback((provider: string, model: string, apiKey: string) => {
    const entries = Object.entries(config.providers);
    const entry = entries.find(([key]) => key === provider);
    if (!entry) return;
    const [, providerConfig] = entry;
    const updatedProvider = { ...providerConfig };
    if (apiKey) updatedProvider.apiKey = apiKey;
    if (model) updatedProvider.defaultModel = model;
    const updated = {
      ...config,
      activeProvider: provider,
      providers: Object.fromEntries(
        entries.map(([key, val]) => [key, key === provider ? updatedProvider : val])
      ),
    };
    saveConfig(updated);
    setConfig(updated);
    localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    setShowWizard(false);
  }, [config]);

  const handleSkipWizard = useCallback(() => {
    localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    setShowWizard(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    trackRequest();
    await sendMessage(userMessage, useContext, editModel);
  }, [input, isLoading, useContext, editModel, sendMessage, trackRequest]);

  const currentApiKey = config.providers[config.activeProvider].apiKey || '';
  const hasKey = currentApiKey.length > 0;

  const availableModels = PROVIDER_MODELS_MAP.get(editProvider) || {};
  const currentModel = config.providers[config.activeProvider].defaultModel || '';
  const providerModelEntries = Object.entries(availableModels);

  const handleDbHandlesSelected = useCallback(async (fileHandle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle) => {
    await saveDbHandles(fileHandle, dirHandle);
    setDbHandle(fileHandle);
    if (confirm('Database connection updated. Reload now to apply changes?')) {
      window.location.reload();
    }
  }, []);

  return (
    <div className="chat-view">
      {showWizard && (
        <SettingsWizard
          config={config}
          onComplete={handleWizardComplete}
          onSkip={handleSkipWizard}
        />
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

      <ChatView
        messages={messages}
        isLoading={isLoading}
        isSourcing={isSourcing}
        resolvedSources={resolvedSources}
        sessionTokens={sessionTokens}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onRemoveSource={(i) => { setResolvedSources(prev => prev.filter((_, j) => j !== i)); }}
        currentModel={currentModel}
        rateLimitLevel={getRateLimitLevel()}
        rateLimitInfo={getRateLimitInfo()}
      />
    </div>
  );
};

export default AIHarness;
