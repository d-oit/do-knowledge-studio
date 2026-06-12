import type { LLMProvider, LLMProviderConfig } from './types';
import { OpenRouterProvider } from './openrouter';
import { KiloGatewayProvider } from './kilo';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { encryptApiKey, decryptApiKey, isEncrypted } from './encryption';

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
    anthropic: {
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: '',
      defaultModel: 'claude-3-5-haiku-20241022',
    },
    ollama: {
      baseURL: 'http://localhost:11434',
      apiKey: '',
      defaultModel: 'llama3.2',
    },
  },
};

export async function loadConfig(): Promise<LLMConfig> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LLMConfig>;
      const config = { ...DEFAULT_CONFIG, ...parsed };

      // Decrypt provider API keys (migrates plaintext keys on the fly)
      const migrated = { ...config, providers: { ...config.providers } };
      let needsSave = false;
      for (const [id, providerConfig] of Object.entries(migrated.providers)) {
        if (providerConfig.apiKey && providerConfig.apiKey.length > 0) {
          migrated.providers[id] = {
            ...providerConfig,
            apiKey: await decryptApiKey(providerConfig.apiKey),
          };
          // Auto-migrate plaintext keys to encrypted
          if (!isEncrypted(providerConfig.apiKey)) {
            needsSave = true;
          }
        }
      }

      if (needsSave) {
        // Re-save with encrypted keys (fire-and-forget)
        void saveConfig(migrated);
      }

      return migrated;
    }
  } catch (e) {
    console.warn('Failed to parse stored LLM config, falling back to defaults', e);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: LLMConfig): Promise<void> {
  // Encrypt all provider API keys before persisting
  const encrypted = { ...config, providers: { ...config.providers } };
  for (const [id, providerConfig] of Object.entries(encrypted.providers)) {
    if (providerConfig.apiKey && providerConfig.apiKey.length > 0 && !isEncrypted(providerConfig.apiKey)) {
      encrypted.providers[id] = {
        ...providerConfig,
        apiKey: await encryptApiKey(providerConfig.apiKey),
      };
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
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
    case 'anthropic':
      return new AnthropicProvider(providerConfig);
    case 'ollama':
      return new OllamaProvider(providerConfig);
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
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  return `...${key.slice(-4)}`;
}

export { OpenRouterProvider, KiloGatewayProvider, AnthropicProvider, OllamaProvider };
