import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '../anthropic';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AnthropicProvider', () => {
  const defaultConfig = {
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant-12345678',
    defaultModel: 'claude-3-5-haiku-20241022',
  };

  describe('constructor', () => {
    it('sets config with defaults', () => {
      const provider = new AnthropicProvider();
      expect(provider.id).toBe('anthropic');
      expect(provider.name).toBe('Anthropic Claude');
      expect(provider.config.baseURL).toBe('https://api.anthropic.com/v1');
    });

    it('merges partial config', () => {
      const provider = new AnthropicProvider({ apiKey: 'my-key', defaultModel: 'custom' });
      expect(provider.config.apiKey).toBe('my-key');
      expect(provider.config.defaultModel).toBe('custom');
    });
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is set', () => {
      expect(new AnthropicProvider(defaultConfig).isConfigured()).toBe(true);
    });

    it('returns false when apiKey is empty', () => {
      expect(new AnthropicProvider({ ...defaultConfig, apiKey: '' }).isConfigured()).toBe(false);
    });
  });

  describe('chat', () => {
    it('returns response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'Claude response' }],
          model: 'claude-3-5-haiku',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      const result = await provider.chat({
        model: 'claude-3-5-haiku',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Claude response');
      expect(result.model).toBe('claude-3-5-haiku');
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    });

    it('converts system messages separately', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }], model: 'm' }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      await provider.chat({
        model: 'm',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matchers return `any` by design
          body: expect.stringContaining('"system":"You are helpful"'),
        })
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      await expect(
        provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Anthropic error: Rate limited');
    });

    it('sends correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: 'text', text: '' }], model: 'm' }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-12345678',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('returns empty content when no text block', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: 'tool_use' }], model: 'm' }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      const result = await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      expect(result.content).toBe('');
    });
  });

  describe('chatStream', () => {
    it('yields content deltas and message_stop', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"message_start","message":{"usage":{"input_tokens":5,"output_tokens":0}}}\n'));
          controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n'));
          controller.enqueue(encoder.encode('data: {"type":"message_delta","usage":{"input_tokens":5,"output_tokens":10}}\n'));
          controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new AnthropicProvider(defaultConfig);
      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.content === 'Hello')).toBe(true);
      expect(chunks.some(c => c.done === true)).toBe(true);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Overloaded',
        json: () => Promise.resolve({ error: { message: 'Server overloaded' } }),
      });

      const provider = new AnthropicProvider(defaultConfig);
      const gen = provider.chatStream({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      await expect(gen.next()).rejects.toThrow('Anthropic error: Server overloaded');
    });

    it('throws when no response body', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: null });
      const provider = new AnthropicProvider(defaultConfig);
      const gen = provider.chatStream({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      await expect(gen.next()).rejects.toThrow('No response body');
    });

    it('handles stream ending without message_stop', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new AnthropicProvider(defaultConfig);
      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.done === true)).toBe(true);
    });
  });
});
