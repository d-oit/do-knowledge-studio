import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maskApiKey, loadConfig, saveConfig, createProvider, getProvider } from '../config';
import { OpenRouterProvider } from '../openrouter';
import { KiloGatewayProvider } from '../kilo';
import { AnthropicProvider } from '../anthropic';
import { OllamaProvider } from '../ollama';

vi.mock('../../key-store', () => {
  const store = new Map<string, string>();
  return {
    keyStore: {
      async get(id: string) { return await Promise.resolve(store.get(id) ?? null); },
      async set(id: string, value: string) { await Promise.resolve(store.set(id, value)); },
      async delete(id: string) { await Promise.resolve(store.delete(id)); },
      async has(id: string) { return await Promise.resolve(store.has(id)); },
    },
    migrateFromLocalStorage: vi.fn().mockResolvedValue(false),
  };
});

describe('maskApiKey', () => {
  it('returns empty string for empty key', () => {
    expect(maskApiKey('')).toBe('');
  });

  it('returns last 4 chars with prefix for short key', () => {
    expect(maskApiKey('abc')).toBe('...abc');
  });

  it('returns last 4 chars with prefix for 7-char key', () => {
    expect(maskApiKey('abcdefg')).toBe('...defg');
  });

  it('returns last 4 chars with prefix for normal key', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('...cdef');
  });

  it('returns last 4 chars with prefix for long key', () => {
    const key = 'a'.repeat(100) + 'xyzw';
    expect(maskApiKey(key)).toBe('...xyzw');
  });
});

describe('loadConfig', () => {
  beforeEach(async () => {
    const { keyStore } = await import('../../key-store');
    await keyStore.delete('dks:llm-config');
  });

  it('returns default config when key store is empty', async () => {
    const config = await loadConfig();
    expect(config.activeProvider).toBe('openrouter');
    expect(config.providers.openrouter.baseURL).toBe('https://openrouter.ai/api/v1');
    expect(config.providers.kilo.baseURL).toBe('https://api.kilo.ai/api/gateway');
  });

  it('merges saved config with defaults (shallow)', async () => {
    const saved = {
      activeProvider: 'kilo',
      providers: {
        openrouter: {
          baseURL: 'https://custom.api/v1',
          apiKey: 'test-key',
          defaultModel: 'custom/model',
        },
        kilo: {
          baseURL: 'https://api.kilo.ai/api/gateway',
          apiKey: '',
          defaultModel: 'custom-kilo',
        },
      },
    };
    const { keyStore } = await import('../../key-store');
    await keyStore.set('dks:llm-config', JSON.stringify(saved));

    const config = await loadConfig();
    expect(config.activeProvider).toBe('kilo');
    expect(config.providers.openrouter.apiKey).toBe('test-key');
    expect(config.providers.openrouter.baseURL).toBe('https://custom.api/v1');
    expect(config.providers.kilo.defaultModel).toBe('custom-kilo');
  });

  it('returns defaults on invalid JSON', async () => {
    const { keyStore } = await import('../../key-store');
    await keyStore.set('dks:llm-config', 'not-json');
    const config = await loadConfig();
    expect(config.activeProvider).toBe('openrouter');
  });
});

describe('saveConfig', () => {
  beforeEach(async () => {
    const { keyStore } = await import('../../key-store');
    await keyStore.delete('dks:llm-config');
  });

  it('persists config to key store', async () => {
    const config = {
      activeProvider: 'kilo',
      providers: {
        openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKey: 'key1', defaultModel: 'm1' },
        kilo: { baseURL: 'https://api.kilo.ai/api/gateway', apiKey: 'key2', defaultModel: 'm2' },
      },
    };
    await saveConfig(config);

    const { keyStore } = await import('../../key-store');
    const stored = JSON.parse((await keyStore.get('dks:llm-config'))!) as { activeProvider: string; providers: { openrouter: { apiKey: string } } };
    expect(stored.activeProvider).toBe('kilo');
    expect(stored.providers.openrouter.apiKey).toMatch(/^enc:v1:/);
    const loaded = await loadConfig();
    expect(loaded.providers.openrouter.apiKey).toBe('key1');
  });
});

describe('createProvider', () => {
  it('creates OpenRouterProvider for openrouter', () => {
    const config = {
      activeProvider: 'openrouter',
      providers: {
        openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKey: 'test', defaultModel: 'm' },
        kilo: { baseURL: 'https://api.kilo.ai/api/gateway', apiKey: '', defaultModel: 'm' },
      },
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it('creates KiloGatewayProvider for kilo', () => {
    const config = {
      activeProvider: 'kilo',
      providers: {
        openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKey: '', defaultModel: 'm' },
        kilo: { baseURL: 'https://api.kilo.ai/api/gateway', apiKey: 'test', defaultModel: 'm' },
      },
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(KiloGatewayProvider);
  });

  it('creates AnthropicProvider for anthropic', () => {
    const config = {
      activeProvider: 'anthropic',
      providers: {
        openrouter: { baseURL: '', apiKey: '', defaultModel: '' },
        kilo: { baseURL: '', apiKey: '', defaultModel: '' },
        anthropic: { baseURL: 'https://api.anthropic.com/v1', apiKey: 'test', defaultModel: 'claude-3-5-haiku-20241022' },
        ollama: { baseURL: '', apiKey: '', defaultModel: '' },
      },
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates OllamaProvider for ollama', () => {
    const config = {
      activeProvider: 'ollama',
      providers: {
        openrouter: { baseURL: '', apiKey: '', defaultModel: '' },
        kilo: { baseURL: '', apiKey: '', defaultModel: '' },
        anthropic: { baseURL: '', apiKey: '', defaultModel: '' },
        ollama: { baseURL: 'http://localhost:11434', apiKey: '', defaultModel: 'llama3.2' },
      },
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('throws for unknown provider', () => {
    const config = {
      activeProvider: 'unknown',
      providers: {
        openrouter: { baseURL: '', apiKey: '', defaultModel: '' },
        kilo: { baseURL: '', apiKey: '', defaultModel: '' },
      },
    };
    expect(() => createProvider(config)).toThrow('Unknown provider: unknown');
  });
});

describe('getProvider', () => {
  it('returns OpenRouterProvider for openrouter id', () => {
    const provider = getProvider('openrouter');
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it('returns KiloGatewayProvider for kilo id', () => {
    const provider = getProvider('kilo');
    expect(provider).toBeInstanceOf(KiloGatewayProvider);
  });

  it('returns AnthropicProvider for anthropic id', () => {
    const provider = getProvider('anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('returns OllamaProvider for ollama id', () => {
    const provider = getProvider('ollama');
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('throws for unknown provider id', () => {
    expect(() => getProvider('unknown')).toThrow('Unknown provider: unknown');
  });
});
