import type { LLMProvider, LLMProviderConfig } from './types';
import { OpenRouterProvider } from './openrouter';
import { KiloGatewayProvider } from './kilo';

const STORAGE_KEY = 'dks:llm-config';

export interface LLMConfig {
  activeProvider: string;
  providers: Record<string, LLMProviderConfig>;
}

const DEFAULT_CONFIG: LLMConfig = {
  activeProvider: 'openrouter',
  providers: {
    openrouter: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: '',
      defaultModel: 'google/gemini-2.0-flash-lite-preview-02-05:free',
    },
    kilo: {
      baseURL: 'https://api.kilo.ai/api/gateway',
      apiKey: '',
      defaultModel: 'meta-llama/llama-3.1-8b-instruct',
    },
  },
};

export function loadConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) as Partial<LLMConfig> };
    }
  } catch (e) {
    console.warn('Failed to parse stored LLM config, falling back to defaults', e);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function createProvider(config: LLMConfig): LLMProvider {
  const providerConfig = config.providers[config.activeProvider];
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${config.activeProvider}`);
  }

  switch (config.activeProvider) {
    case 'openrouter':
      return new OpenRouterProvider(providerConfig);
    case 'kilo':
      return new KiloGatewayProvider(providerConfig);
    default:
      throw new Error(`Unknown provider: ${config.activeProvider}`);
  }
}

export function getProvider(id: string, config?: Partial<LLMProviderConfig>): LLMProvider {
  switch (id) {
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'kilo':
      return new KiloGatewayProvider(config);
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? `...${key.slice(-4)}` : '';
  return `...${key.slice(-4)}`;
}

export { OpenRouterProvider, KiloGatewayProvider };
