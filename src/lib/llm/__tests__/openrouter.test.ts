import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider } from '../openrouter';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenRouterProvider', () => {
  const defaultConfig = {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test-key-12345678',
    defaultModel: 'test-model',
  };

  describe('constructor', () => {
    it('sets config with defaults', () => {
      const provider = new OpenRouterProvider();
      expect(provider.id).toBe('openrouter');
      expect(provider.name).toBe('OpenRouter Free');
      expect(provider.config.baseURL).toBe('https://openrouter.ai/api/v1');
    });

    it('merges partial config', () => {
      const provider = new OpenRouterProvider({
        apiKey: 'my-key',
        defaultModel: 'custom-model',
      });
      expect(provider.config.apiKey).toBe('my-key');
      expect(provider.config.defaultModel).toBe('custom-model');
      expect(provider.config.baseURL).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is set', () => {
      const provider = new OpenRouterProvider(defaultConfig);
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when apiKey is empty', () => {
      const provider = new OpenRouterProvider({ ...defaultConfig, apiKey: '' });
      expect(provider.isConfigured()).toBe(false);
    });

    it('returns false when apiKey is undefined', () => {
      const provider = new OpenRouterProvider({ baseURL: 'https://test.com' });
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('chat', () => {
    it('returns response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
          model: 'gpt-4',
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const provider = new OpenRouterProvider(defaultConfig);
      const result = await provider.chat({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Hello!');
      expect(result.model).toBe('gpt-4');
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: { message: 'Invalid model' },
        }),
      });

      const provider = new OpenRouterProvider(defaultConfig);
      await expect(
        provider.chat({ model: 'bad', messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('OpenRouter error: Invalid model');
    });

    it('handles error response without body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('no body')),
      });

      const provider = new OpenRouterProvider(defaultConfig);
      await expect(
        provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('OpenRouter error: Unknown error');
    });

    it('sends correct headers including Authorization', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: '' } }], model: 'm' }),
      });

      const provider = new OpenRouterProvider(defaultConfig);
      await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matchers return `any` by design; type safety is enforced on the actual fetch call
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key-12345678',
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
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new OpenRouterProvider(defaultConfig);
      const chunks: string[] = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['Hello', ' world', '']);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid key' } }),
      });

      const provider = new OpenRouterProvider(defaultConfig);
      const gen = provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      await expect(gen.next()).rejects.toThrow('OpenRouter error: Invalid key');
    });
  });
});
