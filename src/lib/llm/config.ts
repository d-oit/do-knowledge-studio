import type { LLMProvider, LLMProviderConfig } from './types';
import { OpenRouterProvider } from './openrouter';
import { KiloGatewayProvider } from './kilo';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { encryptApiKey, decryptApiKey, isEncrypted } from './encryption';
import { keyStore, migrateFromLocalStorage } from '../key-store';
import { logger } from '../logger';

const STORAGE_KEY = 'dks:llm-config';
const LEGACY_STORAGE_KEY = 'dks:llm-config';

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
    // Try IndexedDB first, then migrate from localStorage if needed
    let stored = await keyStore.get(STORAGE_KEY);
    if (!stored) {
      const migrated = await migrateFromLocalStorage(LEGACY_STORAGE_KEY, STORAGE_KEY);
      if (migrated) {
        stored = await keyStore.get(STORAGE_KEY);
      }
    }

    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LLMConfig>;
      const config = { ...DEFAULT_CONFIG, ...parsed };

      const migrated = { ...config, providers: { ...config.providers } };
      let needsSave = false;
      for (const [id, providerConfig] of Object.entries(migrated.providers)) {
        if (providerConfig.apiKey && providerConfig.apiKey.length > 0) {
          migrated.providers[id] = {
            ...providerConfig,
            apiKey: await decryptApiKey(providerConfig.apiKey),
          };
          if (!isEncrypted(providerConfig.apiKey)) {
            needsSave = true;
          }
        }
      }

      if (needsSave) {
        void saveConfig(migrated);
      }

      return migrated;
    }
  } catch (err) {
    logger.warn('Failed to load LLM config, falling back to defaults', err);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: LLMConfig): Promise<void> {
  const encrypted = { ...config, providers: { ...config.providers } };
  for (const [id, providerConfig] of Object.entries(encrypted.providers)) {
    if (providerConfig.apiKey && providerConfig.apiKey.length > 0 && !isEncrypted(providerConfig.apiKey)) {
      encrypted.providers[id] = {
        ...providerConfig,
        apiKey: await encryptApiKey(providerConfig.apiKey),
      };
    }
  }
  await keyStore.set(STORAGE_KEY, JSON.stringify(encrypted));
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
