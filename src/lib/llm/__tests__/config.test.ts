import { describe, it, expect, beforeEach } from 'vitest';
import { maskApiKey, loadConfig, saveConfig, createProvider, getProvider } from '../config';
import { OpenRouterProvider } from '../openrouter';
import { KiloGatewayProvider } from '../kilo';

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
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default config when localStorage is empty', async () => {
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
    localStorage.setItem('dks:llm-config', JSON.stringify(saved));

    const config = await loadConfig();
    expect(config.activeProvider).toBe('kilo');
    expect(config.providers.openrouter.apiKey).toBe('test-key');
    expect(config.providers.openrouter.baseURL).toBe('https://custom.api/v1');
    expect(config.providers.kilo.defaultModel).toBe('custom-kilo');
  });

  it('returns defaults on invalid JSON', async () => {
    localStorage.setItem('dks:llm-config', 'not-json');
    const config = await loadConfig();
    expect(config.activeProvider).toBe('openrouter');
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists config to localStorage', async () => {
    const config = {
      activeProvider: 'kilo',
      providers: {
        openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKey: 'key1', defaultModel: 'm1' },
        kilo: { baseURL: 'https://api.kilo.ai/api/gateway', apiKey: 'key2', defaultModel: 'm2' },
      },
    };
    await saveConfig(config);

    const stored = JSON.parse(localStorage.getItem('dks:llm-config')!) as { activeProvider: string; providers: { openrouter: { apiKey: string } } };
    expect(stored.activeProvider).toBe('kilo');
    // API key should be encrypted (starts with enc:v1:)
    expect(stored.providers.openrouter.apiKey).toMatch(/^enc:v1:/);
    // But loading it back should decrypt
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

  it('throws for unknown provider id', () => {
    expect(() => getProvider('unknown')).toThrow('Unknown provider: unknown');
  });
});
