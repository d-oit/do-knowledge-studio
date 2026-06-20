import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { PROVIDER_MODELS } from '../../lib/llm';
import { LLMConfig } from '../../lib/llm/config';
import Overlay from '../../components/Overlay';

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

  const handleNext = () => { setStep(s => s + 1); };
  const handleBack = () => { setStep(s => s - 1); };

  const wizardModelEntries = Object.entries(PROVIDER_MODELS_MAP.get(wizardProvider) || {});

  return (
    <Overlay
      isOpen={true}
      onClose={onSkip}
      variant="center"
      ariaLabel="AI Settings Wizard"
    >
      <div>
        {step === 0 && (
          <>
            <div className="wizard-icon">🤖</div>
            <h2 className="wizard-title">Welcome to AI Harness</h2>
            <p className="wizard-description">
              This assistant can answer questions, analyze URLs, and search your local knowledge base.
              Let&rsquo;s get you set up with an AI provider.
            </p>
            <button type="button" className="primary" onClick={handleNext} style={{ width: '100%' }}>
              Get Started <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h3 style={{ margin: '0 0 16px' }}>Choose Provider &amp; Model</h3>
            <div className="wizard-form">
              <label htmlFor="wizard-provider" className="wizard-label">Provider</label>
              <select
                id="wizard-provider"
                value={wizardProvider}
                onChange={e => {
                  setWizardProvider(e.target.value);
                  const models = PROVIDER_MODELS[e.target.value];
                  const firstModel = Object.values(models)[0] || '';
                  setWizardModel(firstModel);
                }}
              >
                {Object.keys(config.providers).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <label htmlFor="wizard-model" className="wizard-label">Model</label>
              <select
                id="wizard-model"
                value={wizardModel}
                onChange={e => { setWizardModel(e.target.value); }}
              >
                {wizardModelEntries.map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-secondary" style={{ flex: 1 }}>
                Back
              </button>
              <button type="button" className="primary" onClick={handleNext} style={{ flex: 1 }}>
                Next <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ margin: '0 0 16px' }}>Enter API Key</h3>
            <p className="wizard-description" style={{ fontSize: '13px' }}>
              Your API key stays local in your browser. Never shared with anyone.
            </p>
            <input
              ref={wizardApiKeyRef}
              type="password"
              value={wizardApiKey}
              onChange={e => { setWizardApiKey(e.target.value); }}
              placeholder={`Enter ${wizardProvider} API key`}
            />
            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-secondary" style={{ flex: 1 }}>
                Back
              </button>
              <button type="button" className="primary" onClick={() => onComplete(wizardProvider, wizardModel, wizardApiKey)} disabled={!wizardApiKey} style={{ flex: 1 }}>
                <Check size={16} style={{ verticalAlign: 'middle' }} /> Complete Setup
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="wizard-skip"
        >
          Skip setup
        </button>
      </div>
    </Overlay>
  );
};
