import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { PROVIDER_MODELS } from '../../lib/llm';
import { LLMConfig } from '../../lib/llm/config';

const PROVIDER_MODELS_MAP = new Map(Object.entries(PROVIDER_MODELS));

interface SettingsWizardProps {
  config: LLMConfig;
  onComplete: (provider: string, model: string, apiKey: string) => void;
  onSkip: () => void;
}

export const SettingsWizard: React.FC<SettingsWizardProps> = ({ config, onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [wizardApiKey, setWizardApiKey] = useState('');
  const [wizardProvider, setWizardProvider] = useState(config.activeProvider);
  const [wizardModel, setWizardModel] = useState('');
  const wizardApiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2 && wizardApiKeyRef.current) wizardApiKeyRef.current.focus();
  }, [step]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const wizardModelEntries = Object.entries(PROVIDER_MODELS_MAP.get(wizardProvider) || {});

  return (
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
        {step === 0 && (
          <>
            <div style={{ fontSize: '28px', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ margin: '0 0 8px' }}>Welcome to AI Harness</h2>
            <p style={{ color: 'var(--text-secondary, #666)', margin: '0 0 24px', lineHeight: 1.5 }}>
              This assistant can answer questions, analyze URLs, and search your local knowledge base.
              Let&rsquo;s get you set up with an AI provider.
            </p>
            <button type="button" className="primary" onClick={handleNext} style={{ width: '100%', padding: '10px' }}>
              Get Started <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
            </button>
          </>
        )}

        {step === 1 && (
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
              <button type="button" onClick={handleBack} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-default, #ddd)', borderRadius: '6px', cursor: 'pointer' }}>
                Back
              </button>
              <button type="button" className="primary" onClick={handleNext} style={{ flex: 1, padding: '10px' }}>
                Next <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
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
              <button type="button" onClick={handleBack} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-default, #ddd)', borderRadius: '6px', cursor: 'pointer' }}>
                Back
              </button>
              <button type="button" className="primary" onClick={() => onComplete(wizardProvider, wizardModel, wizardApiKey)} disabled={!wizardApiKey} style={{ flex: 1, padding: '10px' }}>
                <Check size={16} style={{ verticalAlign: 'middle' }} /> Complete Setup
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onSkip}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--text-muted, #999)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
        >
          Skip setup
        </button>
      </div>
    </div>
  );
};
