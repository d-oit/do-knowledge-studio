import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KiloGatewayProvider } from '../kilo';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KiloGatewayProvider', () => {
  const defaultConfig = {
    baseURL: 'https://api.kilo.ai/api/gateway',
    apiKey: 'kilo-key-12345678',
    defaultModel: 'test-model',
  };

  describe('constructor', () => {
    it('sets config with defaults', () => {
      const provider = new KiloGatewayProvider();
      expect(provider.id).toBe('kilo');
      expect(provider.name).toBe('Kilo Gateway Free');
      expect(provider.config.baseURL).toBe('https://api.kilo.ai/api/gateway');
    });

    it('merges partial config', () => {
      const provider = new KiloGatewayProvider({
        apiKey: 'my-key',
        defaultModel: 'custom-model',
      });
      expect(provider.config.apiKey).toBe('my-key');
      expect(provider.config.defaultModel).toBe('custom-model');
      expect(provider.config.baseURL).toBe('https://api.kilo.ai/api/gateway');
    });
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is set', () => {
      const provider = new KiloGatewayProvider(defaultConfig);
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when apiKey is empty', () => {
      const provider = new KiloGatewayProvider({ ...defaultConfig, apiKey: '' });
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('chat', () => {
    it('returns response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Kilo response' } }],
          model: 'kilo-model',
          usage: { prompt_tokens: 5, completion_tokens: 15 },
        }),
      });

      const provider = new KiloGatewayProvider(defaultConfig);
      const result = await provider.chat({
        model: 'kilo-model',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Kilo response');
      expect(result.model).toBe('kilo-model');
      expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 15 });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
      });

      const provider = new KiloGatewayProvider(defaultConfig);
      await expect(
        provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Kilo Gateway error: Rate limited');
    });

    it('sends correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: '' } }], model: 'm' }),
      });

      const provider = new KiloGatewayProvider(defaultConfig);
      await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kilo.ai/api/gateway/chat/completions',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matchers return `any` by design; type safety is enforced on the actual fetch call
          headers: expect.objectContaining({
            Authorization: 'Bearer kilo-key-12345678',
          }),
        })
      );
    });
  });

  describe('chatStream', () => {
    it('yields stream chunks', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Kilo"}}]}\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new KiloGatewayProvider(defaultConfig);
      const chunks: string[] = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['Kilo', '']);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve({ error: { message: 'Down' } }),
      });

      const provider = new KiloGatewayProvider(defaultConfig);
      const gen = provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      await expect(gen.next()).rejects.toThrow('Kilo Gateway error: Down');
    });
  });
});
