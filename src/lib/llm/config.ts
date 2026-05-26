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
    },
    kilo: {
      baseURL: 'https://api.kilo.ai/api/gateway',
      apiKey: '',
    },
  },
};

export function loadConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    throw new Error(`Failed to parse LLM config: ${e instanceof Error ? e.message : String(e)}`);
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

export { OpenRouterProvider, KiloGatewayProvider };
